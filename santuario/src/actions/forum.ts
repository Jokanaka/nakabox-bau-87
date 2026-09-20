"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { criarClienteServidor } from "@/lib/supabase/server";

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

export async function criarTopico(
  _anterior: ResultadoAcao | null,
  dados: FormData,
): Promise<ResultadoAcao> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, erro: "O fórum é só para quem está logado." };

  const titulo = String(dados.get("titulo") ?? "").trim();
  const corpo = String(dados.get("corpo") ?? "").trim();
  const santoId = String(dados.get("santo_id") ?? "").trim();

  if (titulo.length < 3) return { ok: false, erro: "Dê um título ao assunto." };
  if (!corpo) return { ok: false, erro: "Escreva alguma coisa." };

  const { data, error } = await supabase
    .from("forum_topicos")
    .insert({
      autor_id: user.id,
      titulo: titulo.slice(0, 160),
      corpo: corpo.slice(0, 8000),
      santo_id: santoId || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/forum");
  redirect(`/forum/${data.id}`);
}

export async function responder(
  _anterior: ResultadoAcao | null,
  dados: FormData,
): Promise<ResultadoAcao> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, erro: "O fórum é só para quem está logado." };

  const topicoId = String(dados.get("topico_id") ?? "");
  const corpo = String(dados.get("corpo") ?? "").trim();

  if (!topicoId) return { ok: false, erro: "Tópico não encontrado." };
  if (!corpo) return { ok: false, erro: "Escreva alguma coisa." };

  const { error } = await supabase.from("forum_respostas").insert({
    topico_id: topicoId,
    autor_id: user.id,
    corpo: corpo.slice(0, 8000),
  });

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/forum/${topicoId}`);
  return { ok: true };
}
