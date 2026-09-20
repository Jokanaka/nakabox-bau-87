import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Destino do link mágico enviado por e-mail. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const destinoBruto = url.searchParams.get("destino") ?? "/forum";

  // Só caminhos internos: nunca redirecionamos para outro site.
  const destino =
    destinoBruto.startsWith("/") && !destinoBruto.startsWith("//")
      ? destinoBruto
      : "/forum";

  if (!code) {
    return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/entrar?erro=expirado", url.origin));
  }

  return NextResponse.redirect(new URL(destino, url.origin));
}
