// =====================================================================
// POST /api/migrar  —  protegido por PIN.
//
// Aplica as colunas novas do schema.sql na tabela do sorteio. Existe porque
// a connection string do banco fica só dentro do Vercel: e daqui, de dentro
// da funcao, que da pra rodar o "add column if not exists" sem ninguem
// precisar copiar a senha do banco pra maquina de ninguem.
//
// Trilhos de seguranca (nao ha como esta rota apagar ou alterar dados de
// inscricao):
//   - so roda comandos de uma LISTA FIXA escrita aqui dentro;
//   - todos sao idempotentes ("if not exists" / preenchem so o que esta
//     vazio) e so na tabela bau87_participantes;
//   - nenhum comando apaga linha, muda nome/fone/cidade nem mexe em ganhador;
//   - o unico update opcional e o de marcar os inscritos ANTIGOS como ja
//     avisados no WhatsApp, e so acontece quando quem chama manda
//     marcarAntigos: true de proposito.
// =====================================================================

import { rota, corpo, responder, conferirPin, consultar } from './_db.js';

const TABELA = 'public.bau87_participantes';

const COLUNAS = [
  ['revenda', 'text'],
  ['frota', 'text'],
  ['qtd_motos', 'text'],
  ['comprador', 'text'],
  ['marca_bau', 'text'],
  ['marca_outra', 'text'],
  ['notificado_whatsapp', 'boolean not null default false'],
  ['notificado_em', 'timestamptz'],
  ['notificado_erro', 'text'],
  ['ficha_num', 'integer'],
];

// ---------------------------------------------------------------------
// Ficha sequencial (>= 1000), guardada em coluna propria.
//
// Antes o numero da ficha era calculado na hora como 1000 + id. Isso deixava
// o numero preso ao id do banco. Agora existe a coluna ficha_num, alimentada
// por uma SEQUENCE do proprio Postgres — o banco garante que dois cliques
// simultaneos nunca tiram o mesmo numero.
//
// As fichas que ja existem NAO sao renumeradas: o backfill grava exatamente
// 1000 + id, que e o numero que aquela pessoa ja viu na tela. A sequencia so
// entao e posicionada acima da maior ficha existente, para a proxima ser
// maior que todas e nunca menor que 1000.
// ---------------------------------------------------------------------
const PASSOS_FICHA = [
  // minvalue 999 para o setval abaixo poder repousar em 999 com a tabela vazia
  // (assim o primeiro nextval devolve exatamente 1000).
  [
    'sequencia',
    `create sequence if not exists public.bau87_ficha_seq as integer minvalue 999 start with 1000`,
  ],
  [
    'backfill-fichas-antigas',
    `update ${TABELA} set ficha_num = 1000 + id where ficha_num is null`,
  ],
  [
    'posicionar-sequencia',
    `select setval(
       'public.bau87_ficha_seq',
       greatest(999, coalesce((select max(ficha_num) from ${TABELA}), 999))
     )`,
  ],
  [
    'default-nextval',
    `alter table ${TABELA} alter column ficha_num set default nextval('public.bau87_ficha_seq')`,
  ],
  // Rede de seguranca: se alguem se inscreveu no meio da migracao (antes do
  // default existir), a linha entra com um numero novo da sequencia.
  [
    'backfill-restantes',
    `update ${TABELA} set ficha_num = nextval('public.bau87_ficha_seq') where ficha_num is null`,
  ],
  [
    'unique-ficha',
    `create unique index if not exists bau87_participantes_ficha_num_idx on ${TABELA} (ficha_num)`,
  ],
  [
    'not-null-ficha',
    `alter table ${TABELA} alter column ficha_num set not null`,
  ],
];

export default rota(async (req, res) => {
  const dados = await corpo(req);
  await conferirPin(dados);

  const aplicados = [];
  for (const [coluna, tipo] of COLUNAS) {
    // Nome e tipo vem da lista fixa acima, nunca do corpo da requisicao.
    if (!/^[a-z_]+$/.test(coluna)) continue;
    await consultar(`alter table ${TABELA} add column if not exists ${coluna} ${tipo}`);
    aplicados.push(coluna);
  }

  const passosFicha = [];
  for (const [nome, sql] of PASSOS_FICHA) {
    await consultar(sql);
    passosFicha.push(nome);
  }

  // Só a pedido explícito: quem já estava inscrito antes do comprovante existir
  // entra como "já avisado", para nunca receber mensagem de um cadastro antigo.
  let antigosMarcados = null;
  if (dados.marcarAntigos === true) {
    const linhas = await consultar(
      `update ${TABELA} set notificado_whatsapp = true
       where notificado_whatsapp = false returning id`
    );
    antigosMarcados = linhas.length;
  }

  const colunas = await consultar(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'bau87_participantes'
     order by ordinal_position`
  );

  // Conferencia: quais travas de unicidade estao MESMO ativas na tabela e onde
  // a numeracao da ficha esta. Só nomes e numeros — nenhum dado de inscrito.
  const indices = await consultar(
    `select indexname, indexdef from pg_indexes
     where schemaname = 'public' and tablename = 'bau87_participantes'
     order by indexname`
  );
  const restricoes = await consultar(
    `select conname, pg_get_constraintdef(oid) as definicao
     from pg_constraint
     where conrelid = '${TABELA}'::regclass and contype in ('u', 'p')
     order by conname`
  );
  const fichas = await consultar(
    `select count(*)::int as inscritos,
            min(ficha_num)::int as menor_ficha,
            max(ficha_num)::int as maior_ficha,
            count(*) filter (where ficha_num is null)::int as sem_ficha
     from ${TABELA}`
  );
  const proxima = await consultar(
    `select last_value::int as ultimo_valor, is_called from public.bau87_ficha_seq`
  );

  responder(res, 200, {
    ok: true,
    aplicados,
    passosFicha,
    antigosMarcados,
    colunas: colunas.map((c) => c.column_name),
    indices: indices.map((i) => ({ nome: i.indexname, definicao: i.indexdef })),
    restricoes: restricoes.map((r) => ({ nome: r.conname, definicao: r.definicao })),
    fichas: fichas[0],
    sequencia: proxima[0],
  });
});
