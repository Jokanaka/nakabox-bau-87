import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { usuarioAtual } from "@/lib/supabase/server";
import { FormEntrar } from "@/components/form-entrar";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre no Santuário com um link mágico enviado por e-mail.",
};

export const dynamic = "force-dynamic";

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; erro?: string }>;
}) {
  const { destino, erro } = await searchParams;

  const usuario = await usuarioAtual().catch(() => null);
  if (usuario) redirect(destino && destino.startsWith("/") ? destino : "/forum");

  const aviso =
    erro === "expirado"
      ? "Este link já foi usado ou expirou. Peça outro."
      : erro === "link"
        ? "O link veio incompleto. Peça outro."
        : "";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <header className="text-center">
        <h1 className="text-3xl text-azul sm:text-4xl">Entrar</h1>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Sem senha: você recebe um link por e-mail e clica nele. Entrar é
          preciso para publicar avistamentos, corrigir verbetes e usar o fórum.
          Identificar uma imagem não exige login.
        </p>
      </header>

      <FormEntrar destino={destino ?? "/forum"} aviso={aviso} />
    </div>
  );
}
