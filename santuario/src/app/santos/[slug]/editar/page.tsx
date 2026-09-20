import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import type { Santo } from "@/lib/tipos";
import { FormEdicao } from "@/components/form-edicao";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Editar verbete" };

export default async function PaginaEditar({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const usuario = await usuarioAtual().catch(() => null);
  if (!usuario) redirect(`/entrar?destino=/santos/${slug}/editar`);

  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("santos")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  const santo = data as Santo | null;
  if (!santo) notFound();

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs text-suave">
          <Link
            href={`/santos/${santo.slug}`}
            className="text-azul underline underline-offset-4"
          >
            ← {santo.nome}
          </Link>
        </p>
        <h1 className="mt-1 text-3xl text-azul">Editar verbete</h1>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Cada campo alterado vira uma entrada no histórico, com a versão
          anterior guardada. Nada é apagado.
        </p>
      </header>

      <FormEdicao santo={santo} />
    </div>
  );
}
