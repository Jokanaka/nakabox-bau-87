import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service role: passa por cima da RLS. Só é usado em /api/identificar,
 * para gravar o scan de quem não está logado, criar o verbete vindo da IA
 * e contar as chamadas por IP. Nunca é importado por código de cliente.
 */
export function criarClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
