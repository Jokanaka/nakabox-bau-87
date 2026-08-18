// =====================================================================
// POST /api/migrar  —  protegido por PIN.
//
// Aplica as colunas novas do schema.sql na tabela do sorteio. Existe porque
// a connection string do banco fica só dentro do Vercel: e daqui, de dentro
// da funcao, que da pra rodar o "add column if not exists" sem ninguem
// precisar copiar a senha do banco pra maquina de ninguem.
//
// Trilhos de seguranca (nao ha como esta rota apagar ou alterar dados):
//   - so roda comandos de uma LISTA FIXA escrita aqui dentro;
//   - todos sao "add column if not exists" (idempotentes: rodar de novo nao
//     muda nada) e so na tabela bau87_participantes;
//   - o unico update possivel e o de marcar os inscritos ANTIGOS como ja
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

  responder(res, 200, {
    ok: true,
    aplicados,
    antigosMarcados,
    colunas: colunas.map((c) => c.column_name),
  });
});
