import { Identificador } from "@/components/identificador";
import { usuarioAtual } from "@/lib/supabase/server";

export default async function PaginaInicial() {
  const usuario = await usuarioAtual().catch(() => null);
  return <Identificador logado={Boolean(usuario)} />;
}
