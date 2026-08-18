// =====================================================================
// NAKABOX — helper de acesso ao Supabase e checagem de PIN.
// Sem nenhuma dependencia npm: só fetch nativo e node:crypto.
// Este arquivo começa com "_", então o Vercel não o publica como rota.
// =====================================================================

import { createHash, timingSafeEqual } from 'node:crypto';

const TABELA = 'inscritos';

// ---------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------

export function ambiente() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const chave = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  const pin = (process.env.ORG_PIN || '').trim();

  const faltando = [];
  if (!url) faltando.push('SUPABASE_URL');
  if (!chave) faltando.push('SUPABASE_SERVICE_KEY');
  if (!pin) faltando.push('ORG_PIN');

  return { url, chave, pin, faltando };
}

/** Erro com status HTTP e mensagem já pronta para mostrar na tela. */
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

/** Garante que a rota só aceita POST. Devolve false se já respondeu. */
export function somentePost(req, res) {
  if (req.method === 'POST') return true;
  res.setHeader('Allow', 'POST');
  responder(res, 405, { erro: 'Método não permitido. Use POST.' });
  return false;
}

/** Lê o corpo da requisição como JSON, aceitando corpo já parseado ou stream. */
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
  // Compara os hashes para o tamanho não denunciar nada e o tempo ser constante.
  const ha = createHash('sha256').update(String(a), 'utf8').digest();
  const hb = createHash('sha256').update(String(b), 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Confere o PIN enviado no corpo contra ORG_PIN. A validação é sempre aqui,
 * no servidor — o JavaScript da página nunca conhece o PIN correto.
 * É assíncrona porque atrasa a resposta quando o PIN está errado.
 */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function conferirPin(dados) {
  const { pin, faltando } = ambiente();
  if (faltando.length) {
    throw new ErroApi(500, `Configuração incompleta no Vercel: falta ${faltando.join(', ')}.`);
  }

  const enviado = typeof dados.pin === 'string' ? dados.pin.trim() : '';
  if (!enviado) throw new ErroApi(401, 'Informe o PIN do organizador.');
  if (!iguaisSemVazarTempo(enviado, pin)) {
    // Meio segundo de espera em cada erro encarece a tentativa de adivinhar o PIN na força bruta.
    await esperar(500);
    throw new ErroApi(401, 'PIN incorreto.');
  }
  return true;
}

// ---------------------------------------------------------------------
// Supabase via REST (PostgREST)
// ---------------------------------------------------------------------

async function chamar(caminho, opcoes = {}) {
  const { url, chave, faltando } = ambiente();
  if (faltando.includes('SUPABASE_URL') || faltando.includes('SUPABASE_SERVICE_KEY')) {
    throw new ErroApi(500, `Configuração incompleta no Vercel: falta ${faltando.join(', ')}.`);
  }

  const cabecalhos = {
    apikey: chave,
    Authorization: `Bearer ${chave}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(opcoes.headers || {}),
  };

  let resposta;
  try {
    resposta = await fetch(`${url}/rest/v1/${caminho}`, { ...opcoes, headers: cabecalhos });
  } catch {
    throw new ErroApi(503, 'Não consegui falar com o banco de dados. Tente de novo em instantes.');
  }

  const texto = await resposta.text();
  let dados = null;
  if (texto) {
    try { dados = JSON.parse(texto); } catch { dados = texto; }
  }

  return { ok: resposta.ok, status: resposta.status, dados, headers: resposta.headers };
}

/** Traduz o erro cru do PostgREST numa mensagem em português. */
function erroDoBanco(resposta) {
  const d = resposta.dados;
  const codigo = d && typeof d === 'object' ? d.code : '';
  const detalhe = d && typeof d === 'object' ? (d.message || d.hint || '') : String(d || '');

  if (codigo === '23505') {
    return new ErroApi(409, 'Esse WhatsApp já está inscrito no sorteio.');
  }
  if (codigo === '42P01' || /relation .* does not exist/i.test(detalhe)) {
    return new ErroApi(500, 'A tabela "inscritos" não existe no Supabase. Rode o schema.sql antes.');
  }
  if (resposta.status === 401 || resposta.status === 403) {
    return new ErroApi(500, 'O Supabase recusou a chave. Confira SUPABASE_SERVICE_KEY no Vercel.');
  }
  return new ErroApi(502, `O banco recusou a operação${detalhe ? `: ${detalhe}` : '.'}`);
}

const PAGINA = 1000;

/**
 * SELECT paginado — traz todas as linhas mesmo passando do limite do PostgREST.
 * `consulta` é a query string já montada (ex.: 'select=id,nome&ganhador=eq.false').
 */
export async function selecionar(consulta) {
  const linhas = [];
  let inicio = 0;

  for (;;) {
    const fim = inicio + PAGINA - 1;
    const resposta = await chamar(`${TABELA}?${consulta}`, {
      method: 'GET',
      headers: { Range: `${inicio}-${fim}`, 'Range-Unit': 'items' },
    });
    if (!resposta.ok) throw erroDoBanco(resposta);

    const lote = Array.isArray(resposta.dados) ? resposta.dados : [];
    linhas.push(...lote);
    if (lote.length < PAGINA) break;
    inicio += PAGINA;
  }

  return linhas;
}

export async function inserir(registro) {
  const resposta = await chamar(TABELA, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(registro),
  });
  if (!resposta.ok) throw erroDoBanco(resposta);
  return Array.isArray(resposta.dados) ? resposta.dados[0] : resposta.dados;
}

export async function atualizar(consulta, campos) {
  const resposta = await chamar(`${TABELA}?${consulta}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(campos),
  });
  if (!resposta.ok) throw erroDoBanco(resposta);
  return Array.isArray(resposta.dados) ? resposta.dados : [];
}

export async function apagar(consulta) {
  const resposta = await chamar(`${TABELA}?${consulta}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
  if (!resposta.ok) throw erroDoBanco(resposta);
  return Array.isArray(resposta.dados) ? resposta.dados : [];
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
  const linhas = await selecionar('select=ganhador&order=id.asc');
  const inscritos = linhas.length;
  const sorteados = linhas.filter((l) => l.ganhador === true).length;
  return { inscritos, sorteados, restantes: inscritos - sorteados };
}

/** Embrulha o handler: erros viram JSON com mensagem legível, nunca stack trace. */
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
