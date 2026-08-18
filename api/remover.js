// =====================================================================
// POST /api/remover  —  protegido por PIN. Apaga um inscrito pelo id.
// =====================================================================

import { rota, corpo, responder, conferirPin, apagar, totais, ficha, ErroApi } from './_db.js';

export default rota(async (req, res) => {
  const dados = await corpo(req);
  await conferirPin(dados);

  const id = Number(dados.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErroApi(400, 'Não entendi qual inscrito remover. Atualize a lista e tente de novo.');
  }

  const removidos = await apagar(`id=eq.${id}`);
  if (!removidos.length) {
    throw new ErroApi(404, 'Esse inscrito já não está mais na lista.');
  }

  responder(res, 200, {
    ok: true,
    removido: { id, ficha: ficha(id), nome: removidos[0].nome },
    totais: await totais(),
  });
});
