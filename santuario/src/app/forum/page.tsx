import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import type { Santo, Topico } from "@/lib/tipos";
import { Cartao, Vazio, dataCurta } from "@/components/ui";
import { FormTopico } from "@/components/form-forum";

export const metadata: Metadata = { title: "Fórum" };

export const dynamic = "force-dynamic";

type Linha = Topico & { santos: Pick<Santo, "slug" | "nome"> | null };

export default async function PaginaForum() {
  const usuario = await usuarioAtual().catch(() => null);
  if (!usuario) redirect("/entrar?destino=/forum");

  const supabase = await criarClienteServidor();

  const [{ data: topicos }, { data: santos }] = await Promise.all([
    supabase
      .from("forum_topicos")
      .select("*, santos(slug, nome)")
      .order("criado_em", { ascending: false })
      .limit(80),
    supabase.from("santos").select("id, slug, nome").order("nome").limit(300),
  ]);

  const lista = (topicos ?? []) as unknown as Linha[];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl text-azul sm:text-4xl">Fórum</h1>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Espaço fechado: só quem entrou lê e escreve aqui. Bom para tirar dúvida
          de iconografia e combinar correções nos verbetes.
        </p>
      </header>

      <FormTopico
        santos={(santos ?? []) as Pick<Santo, "id" | "slug" | "nome">[]}
      />

      {lista.length === 0 ? (
        <Vazio>Nenhum assunto aberto ainda. Comece o primeiro.</Vazio>
      ) : (
        <ul className="space-y-2">
          {lista.map((t) => (
            <li key={t.id}>
              <Link href={`/forum/${t.id}`} className="block no-underline">
                <Cartao className="hover:border-dourado-claro">
                  <h2 className="text-xl leading-snug text-azul">{t.titulo}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-suave">
                    {t.corpo}
                  </p>
                  <p className="mt-2 text-xs text-suave">
                    {dataCurta(t.criado_em)}
                    {t.santos ? ` · sobre ${t.santos.nome}` : ""}
                    {t.autor_id === usuario.id ? " · seu" : ""}
                  </p>
                </Cartao>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
