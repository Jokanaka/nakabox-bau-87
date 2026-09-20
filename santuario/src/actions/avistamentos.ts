"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

/**
 * Publica um avistamento. O usuário informa APENAS o nome do local — o
 * santo vem da identificação e a foto já subiu para o Storage.
 */
export async function publicarAvistamento(input: {
  santo_id: string;
  foto_url: string;
  local_nome: string;
}): Promise<ResultadoAcao> {
  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, erro: "É preciso entrar para publicar um avistamento." };
  }

  const local = input.local_nome.trim();
  if (local.length < 2 || local.length > 120) {
    return { ok: false, erro: "Diga o nome do local (entre 2 e 120 letras)." };
  }
  if (!input.santo_id || !input.foto_url) {
    return { ok: false, erro: "Faltou a identificação ou a foto." };
  }

  const { error } = await supabase.from("avistamentos").insert({
    santo_id: input.santo_id,
    autor_id: user.id,
    foto_url: input.foto_url,
    local_nome: local,
  });

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/feed");
  revalidatePath("/santos");
  return { ok: true };
}
