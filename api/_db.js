// =====================================================================
// NAKABOX — acesso ao banco (Postgres) e checagem de PIN.
//
// O banco e um Postgres comum, apontado pela variavel DATABASE_URL.
// Toda consulta usa parametros ($1, $2...), entao nao existe jeito de um
// texto digitado pelo visitante virar comando SQL.
//
// Este arquivo comeca com "_", entao o Vercel nao o publica como rota.
// =====================================================================

import { createHash, timingSafeEqual } from 'node:crypto';
import pg from 'pg';

// O id da tabela e bigint e o driver, por seguranca, entrega bigint como texto.
// Aqui os ids sao pequenos (numero de inscritos numa feira), entao devolvemos
// numero mesmo — assim o JSON da API sai com id: 7 e nao id: "7".
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

// Tabela exclusiva deste app. O prefixo bau87_ existe para o sorteio nunca
// esbarrar nas tabelas dos outros sistemas que dividem o mesmo banco.
const TABELA = 'bau87_participantes';

// ---------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------

/** Tira o BOM invisivel que o Bloco de Notas do Windows gruda no comeco do texto. */
const BOM = /^\uFEFF/;
function limparValor(bruto) {
  return String(bruto || '').replace(BOM, '').trim();
}

export function ambiente() {
  const urlBanco = limparValor(process.env.DATABASE_URL);
  const pin = limparValor(process.env.ORG_PIN);

  const faltando = [];
  if (!urlBanco) faltando.push('DATABASE_URL');
  if (!pin) faltando.push('ORG_PIN');

  return { urlBanco, pin, faltando };
}

/** Erro com status HTTP e mensagem ja pronta para mostrar na tela. */
export class ErroApi extends Error {
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

// ---------------------------------------------------------------------
// Resposta e leitura do corpo
// ---------------------------------------------------------------------

export function responder(res, status, dados) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(dados));
}

/** Garante que a rota so aceita POST. Devolve false se ja respondeu. */
export function somentePost(req, res) {
  if (req.method === 'POST') return true;
  res.setHeader('Allow', 'POST');
  responder(res, 405, { erro: 'Método não permitido. Use POST.' });
  return false;
}

/** Le o corpo da requisicao como JSON, aceitando corpo ja parseado ou stream. */
export async function corpo(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  let bruto = '';
  if (typeof req.body === 'string') {
    bruto = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    bruto = req.body.toString('utf8');
  } else {
    const pedacos = [];
    for await (const pedaco of req) pedacos.push(pedaco);
    bruto = Buffer.concat(pedacos).toString('utf8');
  }

  if (!bruto.trim()) return {};
  try {
    const dados = JSON.parse(bruto);
    return dados && typeof dados === 'object' ? dados : {};
  } catch {
    throw new ErroApi(400, 'Não consegui ler os dados enviados. Tente de novo.');
  }
}

// ---------------------------------------------------------------------
// PIN do organizador
// ---------------------------------------------------------------------

function iguaisSemVazarTempo(a, b) {
  // Compara os hashes para o tamanho nao denunciar nada e o tempo ser constante.
  const ha = createHash('sha256').update(String(a), 'utf8').digest();
  const hb = createHash('sha256').update(String(b), 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Confere o PIN enviado no corpo contra ORG_PIN. A validacao e sempre aqui,
 * no servidor — o JavaScript da pagina nunca conhece o PIN correto.
 */
export async function conferirPin(dados) {
  const { pin, faltando } = ambiente();
  if (faltando.length) {
    throw new ErroApi(500, `Configuração incompleta no Vercel: falta ${faltando.join(', ')}.`);
  }

  const enviado = typeof dados.pin === 'string' ? dados.pin.trim() : '';
  if (!enviado) throw new ErroApi(401, 'Informe o PIN do organizador.');
  if (!iguaisSemVazarTempo(enviado, pin)) {
    // Meio segundo de espera em cada erro encarece a tentativa de adivinhar o PIN na forca bruta.
    await esperar(500);
    throw new ErroApi(401, 'PIN incorreto.');
  }
  return true;
}

// ---------------------------------------------------------------------
// Conexao com o Postgres
// ---------------------------------------------------------------------

// O pool fica fora do handler: enquanto o Vercel reaproveita a mesma funcao
// quente, a conexao ja aberta e reaproveitada em vez de abrir outra a cada clique.
let pool = null;

function conexao() {
  const { urlBanco, faltando } = ambiente();
  if (faltando.includes('DATABASE_URL')) {
    throw new ErroApi(500, 'Configuração incompleta no Vercel: falta DATABASE_URL.');
  }
  if (pool) return pool;

  // O pooler do Supabase apresenta um certificado assinado por uma CA propria,
  // que nao esta na lista de CAs publicas do Node. A conexao continua criptografada;
  // so a checagem de quem assinou o certificado e dispensada. Por isso qualquer
  // "sslmode" que venha na URL e ignorado: quem manda no TLS e a configuracao abaixo.
  const semSslmode = urlBanco.replace(/([?&])sslmode=[^&]*(&|$)/g, (_, antes, depois) =>
    depois === '&' ? antes : ''
  ).replace(/[?&]$/, '');

  pool = new pg.Pool({
    connectionString: semSslmode,
    ssl: { rejectUnauthorized: false },
    max: 1,               // funcao serverless atende um pedido por vez
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  pool.on('error', () => { /* conexao ociosa derrubada pelo pooler: o proximo query abre outra */ });
  return pool;
}

/** Traduz o erro cru do Postgres numa mensagem em portugues. */
function erroDoBanco(e) {
  const codigo = e && e.code ? String(e.code) : '';

  if (codigo === '23505') {
    return new ErroApi(409, 'Esse WhatsApp já está inscrito no sorteio.');
  }
  if (codigo === '42P01') {
    return new ErroApi(500, `A tabela "${TABELA}" não existe no banco. Rode o schema.sql antes.`);
  }
  if (codigo === '28P01' || codigo === '28000' || codigo === '3D000') {
    return new ErroApi(500, 'O banco recusou a conexão. Confira DATABASE_URL no Vercel.');
  }
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(codigo)) {
    return new ErroApi(503, 'Não consegui falar com o banco de dados. Tente de novo em instantes.');
  }
  console.error('Erro do banco:', codigo, e && e.message);
  return new ErroApi(502, 'O banco recusou a operação. Tente de novo.');
}

/** Roda uma consulta com parametros e devolve as linhas. */
export async function consultar(texto, valores = []) {
  const cliente = conexao();
  try {
    const r = await cliente.query(texto, valores);
    return r.rows;
  } catch (e) {
    throw erroDoBanco(e);
  }
}

// ---------------------------------------------------------------------
// Operacoes do sorteio (todas com parametros, nunca com texto colado)
// ---------------------------------------------------------------------

const CAMPOS = 'id, nome, fone, cidade, ganhador, ganhou_em, criado_em';

/** Insere um inscrito. Telefone repetido estoura ErroApi 409. */
export async function inserir({ nome, fone, cidade }) {
  const linhas = await consultar(
    `insert into ${TABELA} (nome, fone, cidade) values ($1, $2, $3) returning ${CAMPOS}`,
    [nome, fone, cidade]
  );
  return linhas[0];
}

/** Acha o inscrito por telefone (usado quando a pessoa se inscreve duas vezes). */
export async function porFone(fone) {
  const linhas = await consultar(`select ${CAMPOS} from ${TABELA} where fone = $1 limit 1`, [fone]);
  return linhas[0] || null;
}

/** Lista completa, na ordem de inscricao. */
export async function listar() {
  return consultar(`select ${CAMPOS} from ${TABELA} order by id asc`);
}

/** Quem ainda pode ser sorteado. */
export async function candidatos(naoRepetir) {
  return naoRepetir
    ? consultar(`select id, nome, cidade from ${TABELA} where ganhador = false order by id asc`)
    : consultar(`select id, nome, cidade from ${TABELA} order by id asc`);
}

/**
 * Marca o sorteado. Com naoRepetir, a condicao "ganhador = false" e o desempate:
 * se dois organizadores clicarem juntos, o segundo volta vazio e sorteia de novo.
 */
export async function marcarGanhador(id, naoRepetir) {
  const condicao = naoRepetir ? 'where id = $1 and ganhador = false' : 'where id = $1';
  const linhas = await consultar(
    `update ${TABELA} set ganhador = true, ganhou_em = now() ${condicao} returning ${CAMPOS}`,
    [id]
  );
  return linhas;
}

/** Apaga um inscrito pelo id. Devolve as linhas apagadas (vazio = nao existia). */
export async function removerPorId(id) {
  return consultar(`delete from ${TABELA} where id = $1 returning ${CAMPOS}`, [id]);
}

/** Devolve todos os ganhadores para o sorteio. */
export async function zerarGanhadores() {
  return consultar(
    `update ${TABELA} set ganhador = false, ganhou_em = null where ganhador = true returning id`
  );
}

/** Apaga a lista inteira (a tela pede confirmacao dupla antes). */
export async function apagarTudo() {
  return consultar(`delete from ${TABELA} returning id`);
}

// ---------------------------------------------------------------------
// Utilidades de dominio
// ---------------------------------------------------------------------

/** Numero da ficha derivado do id: 7 -> 'NB-1007'. */
export function ficha(id) {
  return `NB-${1000 + Number(id)}`;
}

/** Totais que o painel mostra no topo. */
export async function totais() {
  const linhas = await consultar(
    `select count(*)::int as inscritos, count(*) filter (where ganhador)::int as sorteados from ${TABELA}`
  );
  const { inscritos, sorteados } = linhas[0];
  return { inscritos, sorteados, restantes: inscritos - sorteados };
}

/** Embrulha o handler: erros viram JSON com mensagem legivel, nunca stack trace. */
export function rota(handler) {
  return async function (req, res) {
    try {
      if (!somentePost(req, res)) return;
      await handler(req, res);
    } catch (e) {
      if (e instanceof ErroApi) {
        responder(res, e.status, { erro: e.message, ...e.extra });
        return;
      }
      console.error('Erro inesperado na API:', e);
      responder(res, 500, { erro: 'Falha no servidor ao processar o pedido.' });
    }
  };
}
