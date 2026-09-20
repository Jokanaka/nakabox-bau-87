import type { Metadata } from "next";
import Link from "next/link";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Avistamento, Santo } from "@/lib/tipos";
import { Cartao, LinkBotao, Moldura, SeloTipo, Vazio, dataCurta } from "@/components/ui";

export const metadata: Metadata = {
  title: "Avistamentos",
  description: "Imagens sacras avistadas por aí, em ordem cronológica.",
};

export const dynamic = "force-dynamic";

type Linha = Avistamento & { santos: Santo | null };

export default async function PaginaFeed() {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("avistamentos")
    .select("*, santos(id, slug, nome, tipo)")
    .order("criado_em", { ascending: false })
    .limit(60);

  const avistamentos = (data ?? []) as unknown as Linha[];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl text-azul sm:text-4xl">Avistamentos</h1>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Só imagens sacras, em ordem de chegada. Quem publica informa apenas o
          nome do local — o santo vem da identificação.
        </p>
      </header>

      {error ? (
        <Vazio>Não consegui abrir o feed agora.</Vazio>
      ) : avistamentos.length === 0 ? (
        <div className="space-y-3">
          <Vazio>Ninguém publicou um avistamento ainda.</Vazio>
          <div className="text-center">
            <LinkBotao href="/" variante="principal">
              Identificar uma imagem
            </LinkBotao>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {avistamentos.map((a) => (
            <li key={a.id}>
              <Cartao className="space-y-3">
                <Moldura
                  src={a.foto_url}
                  alt={a.santos?.nome ?? "Imagem sacra"}
                  proporcao="aspect-[4/3]"
                />

                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    {a.santos ? (
                      <Link
                        href={`/santos/${a.santos.slug}`}
                        className="text-xl leading-snug text-azul no-underline hover:underline"
                      >
                        {a.santos.nome}
                      </Link>
                    ) : (
                      <span className="text-xl text-suave">Imagem sacra</span>
                    )}
                    <p className="mt-0.5 text-sm text-tinta">{a.local_nome}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {a.santos ? <SeloTipo tipo={a.santos.tipo} /> : null}
                  </div>
                </div>

                <p className="text-xs text-suave">{dataCurta(a.criado_em)}</p>
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
