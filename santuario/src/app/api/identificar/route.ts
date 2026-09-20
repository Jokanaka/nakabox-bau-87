import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { criarClienteAdmin } from "@/lib/supabase/admin";
import { usuarioAtual } from "@/lib/supabase/server";
import { dentroDoLimite, ipDaRequisicao, LIMITE_POR_HORA } from "@/lib/limite";
import {
  ESQUEMA_IDENTIFICACAO,
  PROMPT_IDENTIFICACAO,
  listaDeTextos,
  normalizarCerteza,
  normalizarSlug,
  normalizarTipo,
  texto,
} from "@/lib/identificacao";
import type { Identificacao } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODELO = process.env.GEMINI_MODELO || "gemini-2.5-flash";
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64 = 8 * 1024 * 1024; // a foto já chega reduzida a 1600 px

function erro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return erro("O servidor está sem a chave GEMINI_API_KEY.", 500);
  }

  let corpo: { imagem?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const imagem = typeof corpo.imagem === "string" ? corpo.imagem : "";
  const casamento = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(imagem);
  if (!casamento) {
    return erro("Envie a foto como data URL em base64.", 400);
  }

  const [, tipoMidia, base64] = casamento as unknown as [string, string, string];
  if (!TIPOS_ACEITOS.includes(tipoMidia.toLowerCase())) {
    return erro("Formato não aceito. Use JPEG, PNG ou WebP.", 415);
  }
  if (base64.length > MAX_BASE64) {
    return erro("A foto ficou grande demais. Tente de novo.", 413);
  }

  const admin = criarClienteAdmin();

  const limite = await dentroDoLimite(admin, ipDaRequisicao(req));
  if (!limite.permitido) {
    return erro(
      `Você chegou ao limite de ${LIMITE_POR_HORA} identificações por hora. Tente daqui a pouco.`,
      429,
    );
  }

  // ---- Identificação -------------------------------------------------
  let bruto: Record<string, unknown>;
  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const resposta = await genai.models.generateContent({
      model: MODELO,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: tipoMidia, data: base64 } },
            { text: "Identifique esta imagem sacra." },
          ],
        },
      ],
      config: {
        systemInstruction: PROMPT_IDENTIFICACAO,
        responseMimeType: "application/json",
        responseSchema: ESQUEMA_IDENTIFICACAO,
        temperature: 0.2,
      },
    });

    bruto = JSON.parse(resposta.text ?? "{}") as Record<string, unknown>;
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error("Falha na identificação:", mensagem);
    if (/429|quota|rate/i.test(mensagem)) {
      return erro(
        "A cota gratuita do modelo se esgotou por enquanto. Tente daqui a pouco.",
        429,
      );
    }
    return erro("Não consegui ler esta foto agora. Tente de novo.", 502);
  }

  if (bruto.eh_imagem_religiosa === false) {
    return NextResponse.json({
      eh_imagem_religiosa: false,
      nome: "",
      slug: "",
      tipo: "santo",
      certeza: "baixa",
      descricao: "",
      sinais: [],
      festa: "",
      padroeiro: "",
      confusao: "",
      alternativas: [],
    } satisfies Identificacao);
  }

  const nome = texto(bruto.nome, 160);
  if (!nome) {
    return erro("Não consegui reconhecer a figura desta foto.", 422);
  }

  const resultado: Identificacao = {
    eh_imagem_religiosa: true,
    nome,
    slug: normalizarSlug(texto(bruto.slug, 120), nome),
    tipo: normalizarTipo(bruto.tipo),
    certeza: normalizarCerteza(bruto.certeza),
    descricao: texto(bruto.descricao),
    sinais: listaDeTextos(bruto.sinais),
    festa: texto(bruto.festa, 200),
    padroeiro: texto(bruto.padroeiro, 300),
    confusao: texto(bruto.confusao),
    alternativas: listaDeTextos(bruto.alternativas),
  };

  // ---- Verbete: vincula se já existe, cria se não existe --------------
  const { data: existente } = await admin
    .from("santos")
    .select("id, slug")
    .eq("slug", resultado.slug)
    .maybeSingle();

  let santoId = existente?.id as string | undefined;
  let verbeteNovo = false;

  if (!santoId) {
    const { data: criado, error: erroCriacao } = await admin
      .from("santos")
      .insert({
        slug: resultado.slug,
        nome: resultado.nome,
        tipo: resultado.tipo,
        resumo: resultado.descricao || null,
        sinais: resultado.sinais,
        festa: resultado.festa || null,
        padroeiro: resultado.padroeiro || null,
        confusao: resultado.confusao || null,
        origem: "ia",
      })
      .select("id")
      .single();

    if (erroCriacao) {
      // Corrida entre duas identificações do mesmo santo: alguém criou primeiro.
      const { data: agora } = await admin
        .from("santos")
        .select("id")
        .eq("slug", resultado.slug)
        .maybeSingle();
      santoId = agora?.id as string | undefined;
    } else {
      santoId = criado?.id as string | undefined;
      verbeteNovo = true;
    }
  }

  // ---- Scan: um registro por identificação, com ou sem login ----------
  if (santoId) {
    const usuario = await usuarioAtual().catch(() => null);
    const { error: erroScan } = await admin.from("scans").insert({
      santo_id: santoId,
      autor_id: usuario?.id ?? null,
      certeza: resultado.certeza,
    });
    if (erroScan) console.error("Falha ao gravar o scan:", erroScan.message);
  }

  return NextResponse.json({
    ...resultado,
    santo_id: santoId,
    verbete_novo: verbeteNovo,
  } satisfies Identificacao);
}
