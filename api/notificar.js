// =====================================================================
// POST /api/notificar  —  protegido por PIN. Usada SO pelo watcher local
// que manda o comprovante no WhatsApp (C:\Users\nakam\nakabox-bau87-watcher).
//
// Por que existe: o site roda na Vercel e o WhatsApp roda na maquina de casa.
// A connection string do banco mora so dentro da Vercel — entao, em vez de
// copiar a senha do banco pra maquina, o watcher pergunta por aqui quem
// ainda nao recebeu e avisa por aqui quando terminou. Nenhum segredo sai.
//
// Duas acoes, nada alem disso:
//   { pin, acao: 'pendentes' }              -> quem ainda nao recebeu
//   { pin, acao: 'marcar', id, erro? }      -> fecha aquele registro
//
// Nao apaga nada, nao altera dados da inscricao, nao muda ganhador.
// =====================================================================

import { rota, corpo, responder, conferirPin, consultar, ficha, ErroApi } from './_db.js';

const TABELA = 'public.bau87_participantes';

// Trava de seguranca: mesmo que algo dê errado no watcher, uma rodada nunca
// puxa a lista inteira de inscritos de uma vez.
const LIMITE = 20;

export default rota(async (req, res) => {
  const dados = await corpo(req);
  await conferirPin(dados);

  const acao = String(dados.acao || '').trim();

  if (acao === 'pendentes') {
    const linhas = await consultar(
      `select id, nome, fone from ${TABELA}
       where notificado_whatsapp = false
       order by id asc limit ${LIMITE}`
    );
    responder(res, 200, {
      ok: true,
      pendentes: linhas.map((l) => ({
        id: l.id,
        ficha: ficha(l.id),
        nome: l.nome,
        fone: l.fone,
      })),
    });
    return;
  }

  if (acao === 'marcar') {
    const id = Number(dados.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroApi(400, 'Informe o id do inscrito.');
    }
    // erro = null quando deu certo; texto curto quando o envio falhou de vez.
    const erro = dados.erro ? String(dados.erro).slice(0, 200) : null;

    // Enviado com sucesso: fecha o registro para nunca receber duas vezes.
    // Falhou: guarda o motivo e NAO fecha (o watcher decide se desiste).
    const linhas = erro
      ? await consultar(
          `update ${TABELA} set notificado_erro = $2 where id = $1 returning id`,
          [id, erro]
        )
      : await consultar(
          `update ${TABELA}
           set notificado_whatsapp = true, notificado_em = now(), notificado_erro = null
           where id = $1 returning id`,
          [id]
        );

    responder(res, 200, { ok: true, atualizados: linhas.length });
    return;
  }

  // "desistir": marca como notificado mesmo tendo falhado, guardando o motivo,
  // para o watcher nao ficar tentando o mesmo numero para sempre.
  if (acao === 'desistir') {
    const id = Number(dados.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErroApi(400, 'Informe o id do inscrito.');
    }
    const erro = String(dados.erro || 'falhou').slice(0, 200);
    const linhas = await consultar(
      `update ${TABELA}
       set notificado_whatsapp = true, notificado_em = now(), notificado_erro = $2
       where id = $1 returning id`,
      [id, erro]
    );
    responder(res, 200, { ok: true, atualizados: linhas.length });
    return;
  }

  // Reabrir o comprovante SO da linha do dono, para provar o caminho inteiro
  // (site -> watcher -> WhatsApp) sem incomodar ninguem. A lista abaixo e fixa:
  // nenhum outro telefone do banco pode ser reaberto por esta rota, entao ela
  // nao serve para reenviar mensagem para cliente nenhum.
  if (acao === 'teste-dono') {
    const PERMITIDOS = ['11973242008'];
    const fone = String(dados.fone || '').replace(/\D/g, '').replace(/^55/, '');
    if (!PERMITIDOS.includes(fone)) {
      throw new ErroApi(403, 'Esta ação só vale para o número do dono.');
    }
    const linhas = await consultar(
      `update ${TABELA}
       set notificado_whatsapp = false, notificado_erro = null
       where fone = $1 returning id`,
      [fone]
    );
    responder(res, 200, { ok: true, reabertos: linhas.length });
    return;
  }

  throw new ErroApi(400, 'Ação desconhecida.');
});
