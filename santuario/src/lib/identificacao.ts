import { Type, type Schema } from "@google/genai";

import { TIPOS, type Certeza, type Tipo } from "@/lib/tipos";

/** Prompt de identificação, conforme a especificação do projeto. */
export const PROMPT_IDENTIFICACAO = `Você é especialista em iconografia católica apostólica romana, na tradição brasileira e ibérica. Identifique a figura pelos atributos visíveis: objetos nas mãos, cores das vestes, hábito religioso, animais, feridas, coroa, auréola, posição do corpo, acompanhantes. Advocações de Nossa Senhora e representações de Cristo não são santos: classifique corretamente em "tipo". Se dois candidatos forem plausíveis, escolha o mais provável e liste o outro em "alternativas". Seja honesto na certeza. Escreva em português do Brasil. Responda apenas com JSON válido, sem markdown, com as chaves: eh_imagem_religiosa, nome, slug, tipo, certeza (alta, média ou baixa), descricao, sinais, festa, padroeiro, confusao, alternativas.

Se a foto não for de uma imagem sacra católica, responda com eh_imagem_religiosa false e deixe os outros campos vazios.`;

/**
 * Esquema no formato aceito pelo responseSchema do Gemini (subconjunto do
 * OpenAPI: sem additionalProperties, tipos em MAIÚSCULAS como no enum Type
 * do SDK). É tipado como Schema de propósito — responseSchema aceita
 * `unknown`, então sem esta anotação o compilador deixaria passar qualquer
 * coisa e o erro só apareceria em produção.
 */
export const ESQUEMA_IDENTIFICACAO: Schema = {
  type: Type.OBJECT,
  properties: {
    eh_imagem_religiosa: { type: Type.BOOLEAN },
    nome: { type: Type.STRING },
    slug: {
      type: Type.STRING,
      description: "minúsculas, sem acento, separado por hífen",
    },
    tipo: { type: Type.STRING, enum: [...TIPOS] },
    certeza: { type: Type.STRING, enum: ["alta", "média", "baixa"] },
    descricao: { type: Type.STRING, description: "2 a 4 frases" },
    sinais: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "atributos iconográficos visíveis",
    },
    festa: { type: Type.STRING },
    padroeiro: { type: Type.STRING },
    confusao: {
      type: Type.STRING,
      description: "com quem se confunde e como diferenciar",
    },
    alternativas: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "eh_imagem_religiosa",
    "nome",
    "slug",
    "tipo",
    "certeza",
    "descricao",
    "sinais",
    "festa",
    "padroeiro",
    "confusao",
    "alternativas",
  ],
  propertyOrdering: [
    "eh_imagem_religiosa",
    "nome",
    "slug",
    "tipo",
    "certeza",
    "descricao",
    "sinais",
    "festa",
    "padroeiro",
    "confusao",
    "alternativas",
  ],
};

/** Slug estável: sem acento, sem pontuação, separado por hífen. */
export function normalizarSlug(bruto: string, reserva: string) {
  const base = (bruto || reserva || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base || "imagem-sacra";
}

export function normalizarTipo(bruto: unknown): Tipo {
  const valor = String(bruto ?? "").toLowerCase().trim();
  return (TIPOS as readonly string[]).includes(valor) ? (valor as Tipo) : "santo";
}

export function normalizarCerteza(bruto: unknown): Certeza {
  const valor = String(bruto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

  if (valor === "alta") return "alta";
  if (valor === "baixa") return "baixa";
  return "média";
}

export function listaDeTextos(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function texto(bruto: unknown, limite = 2000): string {
  return String(bruto ?? "").trim().slice(0, limite);
}
