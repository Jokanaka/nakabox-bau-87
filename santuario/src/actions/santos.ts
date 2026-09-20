"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/server";
import { CAMPOS_EDITAVEIS, TIPOS, type CampoEditavel } from "@/lib/tipos";
import { normalizarSlug } from "@/lib/identificacao";

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

/** Texto de sinais (uma linha por sinal) → literal text[] do Postgres. */
function paraLiteralArray(texto: string) {
  const itens = texto
    .split("\n")
    .map((linha) => linha.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);

  if (itens.length === 0) return "{}";
  return `{${itens.map((i) => `"${i.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

export async function salvarEdicao(
  _anterior: ResultadoAcao | null,
  dados: FormData,
): Promise<ResultadoAcao> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, erro: "É preciso entrar para editar." };

  const santoId = String(dados.get("santo_id") ?? "");
  const slug = String(dados.get("slug") ?? "");
  const justificativa = String(dados.get("justificativa") ?? "").trim();

  if (!santoId) return { ok: false, erro: "Verbete não encontrado." };
  if (justificativa.length < 3) {
    return { ok: false, erro: "Escreva uma justificativa curta para a mudança." };
  }

  let alterados = 0;

  for (const campo of CAMPOS_EDITAVEIS) {
    if (!dados.has(`campo_${campo}`)) continue;

    const bruto = String(dados.get(`campo_${campo}`) ?? "");
    const original = String(dados.get(`original_${campo}`) ?? "");
    if (bruto === original) continue;

    let valor = bruto.trim();

    if (campo === "tipo" && !(TIPOS as readonly string[]).includes(valor)) {
      return { ok: false, erro: `Tipo inválido: ${valor}` };
    }
    if (campo === "nome" && valor.length < 2) {
      return { ok: false, erro: "O nome não pode ficar vazio." };
    }
    if (campo === "sinais") {
      valor = paraLiteralArray(bruto);
    }

    const { error } = await supabase.rpc("editar_santo", {
      p_santo_id: santoId,
      p_campo: campo satisfies CampoEditavel,
      p_valor: valor,
      p_justificativa: justificativa,
    });

    if (error) return { ok: false, erro: error.message };
    alterados++;
  }

  if (alterados === 0) return { ok: false, erro: "Nada mudou." };

  revalidatePath(`/santos/${slug}`);
  revalidatePath("/santos");
  return { ok: true };
}

export async function reverterEdicao(
  edicaoId: string,
  slug: string,
): Promise<ResultadoAcao> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, erro: "É preciso entrar para reverter." };

  const { error } = await supabase.rpc("reverter_edicao", {
    p_edicao_id: edicaoId,
  });

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/santos/${slug}`);
  revalidatePath("/santos");
  return { ok: true };
}

/** Categorias são criadas pelos usuários. */
export async function vincularCategoria(
  _anterior: ResultadoAcao | null,
  dados: FormData,
): Promise<ResultadoAcao> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, erro: "É preciso entrar para classificar." };

  const santoId = String(dados.get("santo_id") ?? "");
  const slug = String(dados.get("slug") ?? "");
  const existente = String(dados.get("categoria_id") ?? "").trim();
  const nova = String(dados.get("categoria_nova") ?? "").trim();

  let categoriaId = existente;

  if (!categoriaId && nova) {
    const slugCategoria = normalizarSlug(nova, nova);

    const { data: jaExiste } = await supabase
      .from("categorias")
      .select("id")
      .eq("slug", slugCategoria)
      .maybeSingle();

    if (jaExiste) {
      categoriaId = jaExiste.id as string;
    } else {
      const { data: criada, error } = await supabase
        .from("categorias")
        .insert({ slug: slugCategoria, nome: nova, autor_id: user.id })
        .select("id")
        .single();

      if (error) return { ok: false, erro: error.message };
      categoriaId = criada.id as string;
    }
  }

  if (!categoriaId) return { ok: false, erro: "Escolha ou crie uma categoria." };

  const { error } = await supabase
    .from("santo_categoria")
    .upsert({ santo_id: santoId, categoria_id: categoriaId });

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/santos/${slug}`);
  revalidatePath("/santos");
  return { ok: true };
}
