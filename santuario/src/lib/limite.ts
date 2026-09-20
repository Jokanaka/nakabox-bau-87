import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const LIMITE_POR_HORA = 20;

/** Nunca guardamos o IP em claro — só um hash com sal do servidor. */
export function hashDoIp(ip: string) {
  const sal = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "santuario";
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex").slice(0, 32);
}

export function ipDaRequisicao(req: Request) {
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "desconhecido";
}

/**
 * 20 identificações por IP por hora, para controlar custo e abuso.
 * A contagem vive no banco porque a Vercel roda cada chamada num
 * processo diferente — contador em memória não seguraria nada.
 */
export async function dentroDoLimite(admin: SupabaseClient, ip: string) {
  const ip_hash = hashDoIp(ip);
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("identificacao_ip")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ip_hash)
    .gte("criado_em", umaHoraAtras);

  if (error) {
    // Se o controle falhar, deixamos passar em vez de derrubar o site.
    console.error("Falha ao consultar o limite por IP:", error.message);
    return { permitido: true, restantes: LIMITE_POR_HORA };
  }

  const usados = count ?? 0;
  if (usados >= LIMITE_POR_HORA) {
    return { permitido: false, restantes: 0 };
  }

  await admin.from("identificacao_ip").insert({ ip_hash });

  // Faxina oportunista dos registros velhos.
  if (Math.random() < 0.05) {
    await admin
      .from("identificacao_ip")
      .delete()
      .lt("criado_em", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  }

  return { permitido: true, restantes: LIMITE_POR_HORA - usados - 1 };
}
