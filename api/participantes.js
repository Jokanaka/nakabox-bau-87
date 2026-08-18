// =====================================================================
// POST /api/participantes  —  protegido por PIN.
// Devolve a lista completa de inscritos e os totais do painel.
// =====================================================================

import { rota, corpo, responder, conferirPin, listar, ficha } from './_db.js';

export default rota(async (req, res) => {
  const dados = await corpo(req);
  await conferirPin(dados);

  const linhas = await listar();

  const participantes = linhas.map((l) => ({
    id: l.id,
    ficha: ficha(l.id),
    nome: l.nome,
    fone: l.fone,
    cidade: l.cidade || '',
    revenda: l.revenda || '',
    frota: l.frota || '',
    comprador: l.comprador || '',
    marcaBau: l.marca_bau || '',
    marcaOutra: l.marca_outra || '',
    ganhador: l.ganhador === true,
    ganhouEm: l.ganhou_em,
    criadoEm: l.criado_em,
  }));

  const sorteados = participantes.filter((p) => p.ganhador);

  // Ultimo ganhador vem do banco: recarregar a pagina nao muda o resultado.
  const ultimoGanhador = sorteados
    .filter((p) => p.ganhouEm)
    .sort((a, b) => new Date(b.ganhouEm) - new Date(a.ganhouEm))[0] || null;

  responder(res, 200, {
    ok: true,
    participantes,
    totais: {
      inscritos: participantes.length,
      sorteados: sorteados.length,
      restantes: participantes.length - sorteados.length,
    },
    ultimoGanhador,
  });
});
