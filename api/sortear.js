// =====================================================================
// POST /api/sortear  —  protegido por PIN.
// O sorteio acontece AQUI, no servidor, com crypto.randomInt, e ja marca
// ganhador = true na mesma requisicao. Recarregar a pagina nao muda nada.
// =====================================================================

import { randomInt } from 'node:crypto';
import { rota, corpo, responder, conferirPin, selecionar, atualizar, totais, ficha, ErroApi } from './_db.js';

const TENTATIVAS = 8; // protege contra dois organizadores clicando ao mesmo tempo

export default rota(async (req, res) => {
  const dados = await corpo(req);
  await conferirPin(dados);

  // Por padrao nao repete quem ja ganhou.
  const naoRepetir = dados.naoRepetir !== false;
  const filtro = naoRepetir ? '&ganhador=eq.false' : '';

  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    const candidatos = await selecionar(`select=id,nome,cidade,ganhador${filtro}&order=id.asc`);

    if (!candidatos.length) {
      // Lista vazia e "todo mundo ja ganhou" sao situacoes diferentes: a mensagem tem que dizer qual e.
      const listaVazia = !naoRepetir || (await totais()).inscritos === 0;
      throw new ErroApi(409, listaVazia
        ? 'Não há ninguém inscrito para sortear ainda.'
        : 'Todo mundo que estava na lista já foi sorteado. Desmarque "não repetir" ou zere os sorteados.');
    }

    const escolhido = candidatos[randomInt(0, candidatos.length)];

    // A condicao ganhador=eq.false no PATCH e o desempate: se alguem sorteou a
    // mesma pessoa um instante antes, a atualizacao volta vazia e sorteamos de novo.
    const condicao = naoRepetir ? `id=eq.${escolhido.id}&ganhador=eq.false` : `id=eq.${escolhido.id}`;
    const atualizados = await atualizar(condicao, {
      ganhador: true,
      ganhou_em: new Date().toISOString(),
    });

    if (!atualizados.length) continue; // alguem chegou primeiro, sorteia outra vez

    const linha = atualizados[0];
    responder(res, 200, {
      ok: true,
      ganhador: {
        id: linha.id,
        ficha: ficha(linha.id),
        nome: linha.nome,
        cidade: linha.cidade || '',
        ganhouEm: linha.ganhou_em,
      },
      totais: await totais(),
    });
    return;
  }

  throw new ErroApi(409, 'O sorteio não conseguiu fechar agora — muita gente sorteando ao mesmo tempo. Tente de novo.');
});
