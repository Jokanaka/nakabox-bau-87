// =====================================================================
// POST /api/inscrever  —  publico, sem PIN.
// Recebe { nome, fone, cidade, autorizo } e devolve o numero da ficha.
// =====================================================================

import { rota, corpo, responder, inserir, ficha, ErroApi } from './_db.js';

// DDDs que existem de verdade no Brasil.
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const LETRAS = /^[A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]+$/;
// Nome de empresa/marca aceita numero (ex.: "MN3", "Moto Center 2000").
const TEXTO_LIVRE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9'’.,\-&/ ]+$/;

// As escolhas viajam como chave curta e sao gravadas com o rotulo que o
// organizador le no painel. Nada que venha de fora entra no banco cru.
const FROTAS = new Map([['propria', 'Própria'], ['terceirizada', 'Terceirizada']]);
// Nakabox e MN3 sao marcas DIFERENTES: cada uma tem a sua opcao. Fichas antigas
// gravadas como "Nakabox/MN3" continuam no banco com o rotulo que ja tinham.
const MARCAS = new Map([['nakabox', 'Nakabox'], ['mn3', 'MN3'], ['outra', 'Outra']]);
const MOTOS = new Map([
  ['1-10', '1 a 10'],
  ['10-50', '10 a 50'],
  ['50-100', '50 a 100'],
  ['100-mais', '100+'],
]);

function limpar(valor) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

function validarNome(bruto) {
  const nome = limpar(bruto);
  if (!nome) throw new ErroApi(400, 'Preencha o nome completo.', { campo: 'nome' });
  if (nome.length < 5) throw new ErroApi(400, 'O nome está curto demais. Escreva nome e sobrenome.', { campo: 'nome' });
  if (nome.length > 80) throw new ErroApi(400, 'O nome pode ter no máximo 80 letras.', { campo: 'nome' });
  if (!LETRAS.test(nome)) throw new ErroApi(400, 'O nome deve ter apenas letras. Tire números e símbolos.', { campo: 'nome' });
  const partes = nome.split(' ').filter((p) => p.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '').length >= 2);
  if (partes.length < 2) throw new ErroApi(400, 'Digite o nome completo: nome e sobrenome.', { campo: 'nome' });
  return nome;
}

function validarFone(bruto) {
  const digitos = String(bruto ?? '').replace(/\D/g, '');
  if (!digitos) throw new ErroApi(400, 'Preencha o WhatsApp com DDD.', { campo: 'fone' });
  if (digitos.length < 10) throw new ErroApi(400, 'O WhatsApp está incompleto. Use DDD + número, com 11 dígitos.', { campo: 'fone' });
  if (digitos.length > 11) throw new ErroApi(400, 'O WhatsApp tem dígitos demais. Use DDD + número, com 11 dígitos.', { campo: 'fone' });

  const ddd = Number(digitos.slice(0, 2));
  if (!DDDS.has(ddd)) throw new ErroApi(400, `O DDD ${digitos.slice(0, 2)} não existe. Confira os dois primeiros dígitos.`, { campo: 'fone' });

  const numero = digitos.slice(2);
  if (numero.length === 9 && numero[0] !== '9') {
    throw new ErroApi(400, 'Celular com 9 dígitos precisa começar com 9 depois do DDD.', { campo: 'fone' });
  }
  if (numero.length === 8 && !/^[6-9]/.test(numero)) {
    throw new ErroApi(400, 'Esse não parece um número de celular. Confira o WhatsApp.', { campo: 'fone' });
  }
  if (/^(\d)\1+$/.test(numero)) {
    throw new ErroApi(400, 'Esse número não parece válido. Confira o WhatsApp.', { campo: 'fone' });
  }

  return digitos; // guardamos só os digitos, sem mascara.
}

function validarCidade(bruto) {
  const cidade = limpar(bruto);
  if (!cidade) return null; // cidade e opcional
  if (cidade.length < 2) throw new ErroApi(400, 'O nome da cidade está curto demais.', { campo: 'cidade' });
  if (cidade.length > 60) throw new ErroApi(400, 'O nome da cidade pode ter no máximo 60 letras.', { campo: 'cidade' });
  if (!LETRAS.test(cidade)) throw new ErroApi(400, 'A cidade deve ter apenas letras.', { campo: 'cidade' });
  return cidade;
}

function validarRevenda(bruto) {
  const revenda = limpar(bruto);
  if (!revenda) throw new ErroApi(400, 'Preencha o nome da revenda.', { campo: 'revenda' });
  if (revenda.length < 2) throw new ErroApi(400, 'O nome da revenda está curto demais.', { campo: 'revenda' });
  if (revenda.length > 80) throw new ErroApi(400, 'O nome da revenda pode ter no máximo 80 letras.', { campo: 'revenda' });
  if (!TEXTO_LIVRE.test(revenda)) throw new ErroApi(400, 'O nome da revenda tem símbolos que não valem aqui.', { campo: 'revenda' });
  return revenda;
}

function validarComprador(bruto) {
  const comprador = limpar(bruto);
  if (!comprador) throw new ErroApi(400, 'Preencha o nome do comprador.', { campo: 'comprador' });
  if (comprador.length < 3) throw new ErroApi(400, 'O nome do comprador está curto demais.', { campo: 'comprador' });
  if (comprador.length > 80) throw new ErroApi(400, 'O nome do comprador pode ter no máximo 80 letras.', { campo: 'comprador' });
  if (!LETRAS.test(comprador)) throw new ErroApi(400, 'O nome do comprador deve ter apenas letras.', { campo: 'comprador' });
  return comprador;
}

function validarFrota(bruto) {
  const chave = limpar(bruto).toLowerCase();
  const rotulo = FROTAS.get(chave);
  if (!rotulo) throw new ErroApi(400, 'Escolha se a frota é própria ou terceirizada.', { campo: 'frota' });
  return rotulo;
}

function validarQtdMotos(bruto) {
  const chave = limpar(bruto).toLowerCase();
  const rotulo = MOTOS.get(chave);
  if (!rotulo) throw new ErroApi(400, 'Escolha quantas motos você tem.', { campo: 'motos' });
  return rotulo;
}

/** Devolve [marcaBau, marcaOutra]; o "qual?" so e exigido quando a escolha e "Outra". */
function validarMarca(brutoMarca, brutoOutra) {
  const chave = limpar(brutoMarca).toLowerCase();
  const rotulo = MARCAS.get(chave);
  if (!rotulo) throw new ErroApi(400, 'Escolha a marca do baú homologado pela Ambev.', { campo: 'marca' });
  if (chave !== 'outra') return [rotulo, null];

  const outra = limpar(brutoOutra);
  if (!outra) throw new ErroApi(400, 'Escreva qual é a marca do baú.', { campo: 'marca-outra' });
  if (outra.length < 2) throw new ErroApi(400, 'O nome da marca está curto demais.', { campo: 'marca-outra' });
  if (outra.length > 60) throw new ErroApi(400, 'O nome da marca pode ter no máximo 60 letras.', { campo: 'marca-outra' });
  if (!TEXTO_LIVRE.test(outra)) throw new ErroApi(400, 'O nome da marca tem símbolos que não valem aqui.', { campo: 'marca-outra' });
  return [rotulo, outra];
}

export default rota(async (req, res) => {
  const dados = await corpo(req);

  const nome = validarNome(dados.nome);
  const fone = validarFone(dados.fone);
  const cidade = validarCidade(dados.cidade);
  const revenda = validarRevenda(dados.revenda);
  const frota = validarFrota(dados.frota);
  const qtdMotos = validarQtdMotos(dados.motos);
  const comprador = validarComprador(dados.comprador);
  const [marcaBau, marcaOutra] = validarMarca(dados.marca, dados.marcaOutra);

  if (dados.autorizo !== true) {
    throw new ErroApi(400, 'Marque a autorização de contato para participar.', { campo: 'autorizo' });
  }

  // Numero repetido e RECUSADO. Quem ja se inscreveu nao tira ficha nova nem
  // recebe a antiga de volta: a unique em "fone" no banco derruba o insert e
  // o erro 409 sobe com a mensagem que a pessoa le na tela, apontando o campo
  // do WhatsApp. Um numero, uma ficha — nada de duas chances no sorteio.
  const registro = await inserir({ nome, fone, cidade, revenda, frota, qtdMotos, comprador, marcaBau, marcaOutra });
  responder(res, 201, {
    ok: true,
    ficha: ficha(registro),
    nome: registro.nome,
  });
});
