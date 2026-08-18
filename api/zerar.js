// =====================================================================
// POST /api/zerar  —  protegido por PIN.
// tipo = "ganhadores"  -> devolve todo mundo para o sorteio
// tipo = "tudo"        -> apaga a lista inteira (a tela pede confirmacao dupla)
// =====================================================================

import { rota, corpo, responder, conferirPin, zerarGanhadores, apagarTudo, totais, ErroApi } from './_db.js';

export default rota(async (req, res) => {
  const dados = await corpo(req);
  await conferirPin(dados);

  const tipo = String(dados.tipo || '').trim();

  if (tipo === 'ganhadores') {
    const alterados = await zerarGanhadores();
    responder(res, 200, {
      ok: true,
      tipo,
      afetados: alterados.length,
      mensagem: alterados.length
        ? `${alterados.length} ganhador(es) voltaram para o sorteio.`
        : 'Não havia nenhum ganhador marcado.',
      totais: await totais(),
    });
    return;
  }

  if (tipo === 'tudo') {
    if (dados.confirmacao !== 'APAGAR') {
      throw new ErroApi(400, 'Confirmação inválida. Digite APAGAR para limpar a lista inteira.');
    }
    const removidos = await apagarTudo();
    responder(res, 200, {
      ok: true,
      tipo,
      afetados: removidos.length,
      mensagem: removidos.length
        ? `${removidos.length} inscrito(s) foram apagados.`
        : 'A lista já estava vazia.',
      totais: await totais(),
    });
    return;
  }

  throw new ErroApi(400, 'Tipo de limpeza inválido. Use "ganhadores" ou "tudo".');
});
