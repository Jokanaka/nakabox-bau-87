import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente com a chave anônima e a sessão do visitante. Toda leitura e
 * escrita passa pela RLS — é este o cliente usado em páginas e ações.
 */
export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Em Server Components a gravação de cookie é bloqueada; o
            // middleware já cuida de renovar a sessão.
          }
        },
      },
    },
  );
}

export async function usuarioAtual() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
