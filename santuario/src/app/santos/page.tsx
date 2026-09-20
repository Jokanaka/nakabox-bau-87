import type { Metadata } from "next";
import Link from "next/link";

import { criarClienteServidor } from "@/lib/supabase/server";
import { ROTULO_TIPO, type Categoria, type SantoComContagem } from "@/lib/tipos";
import { Cartao, Moldura, Selo, SeloTipo, Vazio } from "@/components/ui";

export const metadata: Metadata = {
  title: "O livro dos santos",
  description:
    "Enciclopédia de imagens sacras católicas, escrita e corrigida pela comunidade.",
};

export const dynamic = "force-dynamic";

type Busca = { categoria?: string; ordem?: string };

export default async function PaginaSantos({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const { categoria, ordem } = await searchParams;
  const porScans = ordem === "escaneados";
  const supabase = await criarClienteServidor();

  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, slug, nome, descricao")
    .order("nome");

  const listaCategorias = (categorias ?? []) as Categoria[];
  const categoriaAtiva = listaCategorias.find((c) => c.slug === categoria);

  let idsFiltrados: string[] | null = null;
  if (categoriaAtiva) {
    const { data: vinculos } = await supabase
      .from("santo_categoria")
      .select("santo_id")
      .eq("categoria_id", categoriaAtiva.id);
    idsFiltrados = (vinculos ?? []).map((v) => v.santo_id as string);
  }

  let consulta = supabase
    .from("santos_ranking")
    .select("*")
    .order(porScans ? "total_scans" : "nome", { ascending: !porScans })
    .limit(300);

  if (idsFiltrados) {
    consulta = idsFiltrados.length
      ? consulta.in("id", idsFiltrados)
      : consulta.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: santos, error } = await consulta;
  const lista = (santos ?? []) as SantoComContagem[];

  const base = (extra: Busca) => {
    const p = new URLSearchParams();
    const cat = extra.categoria ?? categoria;
    const ord = extra.ordem ?? ordem;
    if (cat) p.set("categoria", cat);
    if (ord) p.set("ordem", ord);
    const q = p.toString();
    return q ? `/santos?${q}` : "/santos";
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl text-azul sm:text-4xl">O livro dos santos</h1>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Cada verbete pode ser corrigido por quem está logado, e toda alteração
          fica registrada no histórico.
        </p>
      </header>

      <div className="space-y-3">
        <nav aria-label="Ordem" className="flex gap-2">
          <Link
            href={base({ ordem: "" })}
            aria-current={!porScans ? "true" : undefined}
            className={`versalete rounded-full border px-3 py-1.5 text-[0.7rem] no-underline ${
              !porScans
                ? "border-azul bg-azul-claro text-azul"
                : "border-borda bg-white text-suave"
            }`}
          >
            Ordem alfabética
          </Link>
          <Link
            href={base({ ordem: "escaneados" })}
            aria-current={porScans ? "true" : undefined}
            className={`versalete rounded-full border px-3 py-1.5 text-[0.7rem] no-underline ${
              porScans
                ? "border-azul bg-azul-claro text-azul"
                : "border-borda bg-white text-suave"
            }`}
          >
            Mais escaneados
          </Link>
        </nav>

        {listaCategorias.length > 0 ? (
          <nav aria-label="Categorias" className="-mx-1 overflow-x-auto">
            <ul className="flex gap-1.5 whitespace-nowrap px-1 pb-1">
              <li>
                <Link
                  href={base({ categoria: "" })}
                  className={`versalete block rounded-full border px-3 py-1.5 text-[0.7rem] no-underline ${
                    !categoriaAtiva
                      ? "border-dourado-claro bg-[#fdf9ef] text-dourado"
                      : "border-borda bg-white text-suave"
                  }`}
                >
                  Todas
                </Link>
              </li>
              {listaCategorias.map((c) => (
                <li key={c.id}>
                  <Link
                    href={base({ categoria: c.slug })}
                    className={`versalete block rounded-full border px-3 py-1.5 text-[0.7rem] no-underline ${
                      categoriaAtiva?.id === c.id
                        ? "border-dourado-claro bg-[#fdf9ef] text-dourado"
                        : "border-borda bg-white text-suave"
                    }`}
                  >
                    {c.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {categoriaAtiva?.descricao ? (
        <p className="border-l-2 border-dourado-claro pl-3 text-sm leading-relaxed text-suave">
          {categoriaAtiva.descricao}
        </p>
      ) : null}

      {error ? (
        <Vazio>
          Não consegui abrir o livro agora. Confira se o banco já foi criado com
          o <code>supabase/schema.sql</code>.
        </Vazio>
      ) : lista.length === 0 ? (
        <Vazio>
          {categoriaAtiva
            ? "Nenhum verbete nesta categoria ainda."
            : "O livro ainda está vazio. Rode o supabase/seed.sql ou identifique uma imagem."}
        </Vazio>
      ) : (
        <ul className="space-y-2">
          {lista.map((santo) => (
            <li key={santo.id}>
              <Link href={`/santos/${santo.slug}`} className="block no-underline">
                <Cartao className="flex items-center gap-3 hover:border-dourado-claro">
                  <div className="w-16 shrink-0 sm:w-20">
                    <Moldura
                      src={santo.foto_capa}
                      alt={santo.nome}
                      proporcao="aspect-square"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-xl leading-snug text-azul">
                      {santo.nome}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-suave">
                      {santo.resumo ?? ROTULO_TIPO[santo.tipo]}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <SeloTipo tipo={santo.tipo} />
                      {santo.origem === "ia" ? (
                        <Selo tom="atencao">aguardando revisão</Selo>
                      ) : null}
                      {porScans ? (
                        <Selo>
                          {santo.total_scans}{" "}
                          {santo.total_scans === 1 ? "scan" : "scans"}
                        </Selo>
                      ) : null}
                    </div>
                  </div>
                </Cartao>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
