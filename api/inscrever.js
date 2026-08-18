// =====================================================================
// POST /api/inscrever  —  publico, sem PIN.
// Recebe { nome, fone, cidade, autorizo } e devolve o numero da ficha.
// =====================================================================

import { rota, corpo, responder, selecionar, inserir, ficha, ErroApi } from './_db.js';

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

export default rota(async (req, res) => {
  const dados = await corpo(req);

  const nome = validarNome(dados.nome);
  const fone = validarFone(dados.fone);
  const cidade = validarCidade(dados.cidade);

  if (dados.autorizo !== true) {
    throw new ErroApi(400, 'Marque a autorização de contato para participar.', { campo: 'autorizo' });
  }

  try {
    const registro = await inserir({ nome, fone, cidade });
    responder(res, 201, {
      ok: true,
      ficha: ficha(registro.id),
      nome: registro.nome,
      jaInscrito: false,
    });
  } catch (e) {
    // Telefone repetido: em vez de barrar a pessoa, devolvemos a ficha que ela ja tem.
    if (e instanceof ErroApi && e.status === 409) {
      const existentes = await selecionar(`select=id,nome&fone=eq.${encodeURIComponent(fone)}&limit=1`);
      if (existentes.length) {
        responder(res, 200, {
          ok: true,
          ficha: ficha(existentes[0].id),
          nome: existentes[0].nome,
          jaInscrito: true,
        });
        return;
      }
    }
    throw e;
  }
});
