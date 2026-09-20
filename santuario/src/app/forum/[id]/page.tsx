import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import type { Resposta, Santo, Topico } from "@/lib/tipos";
import { Cartao, dataHora } from "@/components/ui";
import { FormResposta } from "@/components/form-forum";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Assunto do fórum" };

type Linha = Topico & { santos: Pick<Santo, "slug" | "nome"> | null };

export default async function PaginaTopico({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await usuarioAtual().catch(() => null);
  if (!usuario) redirect(`/entrar?destino=/forum/${id}`);

  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("forum_topicos")
    .select("*, santos(slug, nome)")
    .eq("id", id)
    .maybeSingle();

  const topico = data as unknown as Linha | null;
  if (!topico) notFound();

  const { data: respostas } = await supabase
    .from("forum_respostas")
    .select("*")
    .eq("topico_id", id)
    .order("criado_em");

  const lista = (respostas ?? []) as Resposta[];

  return (
    <div className="space-y-4">
      <p className="text-xs text-suave">
        <Link href="/forum" className="text-azul underline underline-offset-4">
          ← Fórum
        </Link>
      </p>

      <article className="space-y-3">
        <header>
          <h1 className="text-3xl leading-tight text-azul">{topico.titulo}</h1>
          <p className="mt-1 text-xs text-suave">
            {dataHora(topico.criado_em)}
            {topico.autor_id === usuario.id ? " · seu" : ""}
            {topico.santos ? (
              <>
                {" · "}
                <Link
                  href={`/santos/${topico.santos.slug}`}
                  className="text-azul underline underline-offset-4"
                >
                  {topico.santos.nome}
                </Link>
              </>
            ) : null}
          </p>
        </header>

        <Cartao>
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">
            {topico.corpo}
          </p>
        </Cartao>
      </article>

      <section className="space-y-3">
        <h2 className="versalete text-[0.7rem] text-dourado">
          {lista.length === 0
            ? "Sem respostas"
            : `${lista.length} ${lista.length === 1 ? "resposta" : "respostas"}`}
        </h2>

        {lista.length > 0 ? (
          <ul className="space-y-2">
            {lista.map((r) => (
              <li key={r.id}>
                <Cartao>
                  <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">
                    {r.corpo}
                  </p>
                  <p className="mt-2 text-xs text-suave">
                    {dataHora(r.criado_em)}
                    {r.autor_id === usuario.id ? " · sua" : ""}
                  </p>
                </Cartao>
              </li>
            ))}
          </ul>
        ) : null}

        <FormResposta topicoId={topico.id} />
      </section>
    </div>
  );
}
