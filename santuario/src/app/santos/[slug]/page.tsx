import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import {
  ROTULO_CAMPO,
  ROTULO_TIPO,
  type Avistamento,
  type Categoria,
  type Edicao,
  type SantoComContagem,
} from "@/lib/tipos";
import {
  Campo,
  Cartao,
  LinkBotao,
  Moldura,
  Selo,
  SeloTipo,
  Vazio,
  dataCurta,
  dataHora,
} from "@/components/ui";
import { BotaoReverter } from "@/components/botao-reverter";
import { FormCategoria } from "@/components/form-categoria";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type Busca = { aba?: string };

async function carregar(slug: string) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("santos_ranking")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data as SantoComContagem | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const santo = await carregar(slug).catch(() => null);
  if (!santo) return { title: "Verbete não encontrado" };

  return {
    title: santo.nome,
    description: santo.resumo ?? `Verbete de ${santo.nome} no livro dos santos.`,
  };
}

export default async function PaginaVerbete({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Busca>;
}) {
  const { slug } = await params;
  const { aba } = await searchParams;
  const historico = aba === "historico";

  const santo = await carregar(slug);
  if (!santo) notFound();

  const supabase = await criarClienteServidor();
  const usuario = await usuarioAtual().catch(() => null);

  const [{ data: vinculos }, { data: todasCategorias }, { data: edicoes }, { data: avistamentos }] =
    await Promise.all([
      supabase
        .from("santo_categoria")
        .select("categorias(id, slug, nome, descricao)")
        .eq("santo_id", santo.id),
      supabase.from("categorias").select("id, slug, nome, descricao").order("nome"),
      supabase
        .from("edicoes")
        .select("*")
        .eq("santo_id", santo.id)
        .order("criado_em", { ascending: false })
        .limit(200),
      supabase
        .from("avistamentos")
        .select("*")
        .eq("santo_id", santo.id)
        .order("criado_em", { ascending: false })
        .limit(24),
    ]);

  // O PostgREST devolve o embed ora como objeto, ora como lista.
  const categorias = (vinculos ?? [])
    .flatMap((v) => {
      const bruto = (v as unknown as { categorias: Categoria | Categoria[] | null })
        .categorias;
      if (!bruto) return [];
      return Array.isArray(bruto) ? bruto : [bruto];
    })
    .filter((c): c is Categoria => Boolean(c?.id));

  const listaEdicoes = (edicoes ?? []) as Edicao[];
  const listaAvistamentos = (avistamentos ?? []) as Avistamento[];

  return (
    <div className="space-y-5">
      <article className="space-y-4">
        <Cartao className="space-y-4">
          <div className="sm:flex sm:items-start sm:gap-5">
            <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-44">
              <Moldura src={santo.foto_capa} alt={santo.nome} prioridade />
            </div>

            <div className="mt-4 min-w-0 flex-1 sm:mt-0">
              <h1 className="text-3xl leading-tight text-azul sm:text-4xl">
                {santo.nome}
              </h1>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <SeloTipo tipo={santo.tipo} />
                {santo.origem === "ia" ? (
                  <Selo tom="atencao">aguardando revisão da comunidade</Selo>
                ) : null}
                {santo.origem === "seed" ? <Selo tom="dourado">acervo</Selo> : null}
                <Selo>
                  {santo.total_scans}{" "}
                  {santo.total_scans === 1 ? "scan" : "scans"}
                </Selo>
              </div>

              {categorias.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {categorias.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/santos?categoria=${c.slug}`}
                        className="versalete rounded-full border border-borda bg-white px-2.5 py-0.5 text-[0.68rem] text-suave no-underline hover:border-dourado-claro hover:text-dourado"
                      >
                        {c.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-3 text-xs text-suave">
                Atualizado em {dataCurta(santo.atualizado_em)}
              </p>
            </div>
          </div>
        </Cartao>

        <nav aria-label="Abas do verbete" className="flex gap-2">
          <Link
            href={`/santos/${santo.slug}`}
            aria-current={!historico ? "true" : undefined}
            className={`versalete rounded-full border px-3 py-1.5 text-[0.7rem] no-underline ${
              !historico
                ? "border-azul bg-azul-claro text-azul"
                : "border-borda bg-white text-suave"
            }`}
          >
            Verbete
          </Link>
          <Link
            href={`/santos/${santo.slug}?aba=historico`}
            aria-current={historico ? "true" : undefined}
            className={`versalete rounded-full border px-3 py-1.5 text-[0.7rem] no-underline ${
              historico
                ? "border-azul bg-azul-claro text-azul"
                : "border-borda bg-white text-suave"
            }`}
          >
            Histórico ({listaEdicoes.length})
          </Link>
          <LinkBotao
            href={`/santos/${santo.slug}/editar`}
            className="ml-auto !min-h-0 !px-3 !py-1.5 !text-[0.7rem]"
          >
            Editar
          </LinkBotao>
        </nav>

        {historico ? (
          <Historico
            edicoes={listaEdicoes}
            slug={santo.slug}
            logado={Boolean(usuario)}
          />
        ) : (
          <Cartao className="space-y-3">
            <Campo rotulo="Quem é">{santo.resumo}</Campo>

            {santo.sinais.length > 0 ? (
              <Campo rotulo="Como reconhecer">
                <ul className="list-disc space-y-0.5 pl-5">
                  {santo.sinais.map((sinal) => (
                    <li key={sinal}>{sinal}</li>
                  ))}
                </ul>
              </Campo>
            ) : null}

            <Campo rotulo="Festa">{santo.festa}</Campo>
            <Campo rotulo="Padroeiro">{santo.padroeiro}</Campo>
            <Campo rotulo="Não confunda">{santo.confusao}</Campo>
            <Campo rotulo="Tipo">{ROTULO_TIPO[santo.tipo]}</Campo>
          </Cartao>
        )}
      </article>

      {!historico ? (
        <FormCategoria
          santoId={santo.id}
          slug={santo.slug}
          logado={Boolean(usuario)}
          categorias={(todasCategorias ?? []) as Categoria[]}
          jaVinculadas={categorias.map((c) => c.id)}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-2xl text-azul">Avistamentos</h2>
        {listaAvistamentos.length === 0 ? (
          <Vazio>Ninguém publicou um avistamento deste santo ainda.</Vazio>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {listaAvistamentos.map((a) => (
              <li key={a.id} className="space-y-1.5">
                <Moldura src={a.foto_url} alt={santo.nome} proporcao="aspect-square" />
                <p className="text-xs leading-snug text-suave">
                  {a.local_nome}
                  <span className="block text-[0.68rem]">{dataCurta(a.criado_em)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Historico({
  edicoes,
  slug,
  logado,
}: {
  edicoes: Edicao[];
  slug: string;
  logado: boolean;
}) {
  if (edicoes.length === 0) {
    return <Vazio>Este verbete ainda não foi alterado desde que nasceu.</Vazio>;
  }

  return (
    <Cartao className="space-y-4">
      <p className="text-xs leading-relaxed text-suave">
        Nada é apagado. Reverter grava uma nova entrada no histórico, com a
        versão antiga de volta no verbete.
      </p>

      <ol className="space-y-4">
        {edicoes.map((e) => (
          <li key={e.id} className="border-t border-borda pt-3 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="versalete text-[0.7rem] text-dourado">
                {ROTULO_CAMPO[e.campo] ?? e.campo}
              </h3>
              <span className="text-xs text-suave">{dataHora(e.criado_em)}</span>
            </div>

            {e.justificativa ? (
              <p className="mt-1 text-sm text-tinta">{e.justificativa}</p>
            ) : null}

            <dl className="mt-2 space-y-1 text-xs leading-relaxed">
              <div>
                <dt className="versalete inline text-[0.65rem] text-suave">antes: </dt>
                <dd className="inline text-suave line-through decoration-1">
                  {e.valor_anterior || "(vazio)"}
                </dd>
              </div>
              <div>
                <dt className="versalete inline text-[0.65rem] text-suave">agora: </dt>
                <dd className="inline text-tinta">{e.valor_novo || "(vazio)"}</dd>
              </div>
            </dl>

            {logado ? (
              <div className="mt-2">
                <BotaoReverter edicaoId={e.id} slug={slug} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      {!logado ? (
        <p className="text-xs text-suave">
          <Link href="/entrar" className="text-azul underline underline-offset-4">
            Entre
          </Link>{" "}
          para reverter uma versão.
        </p>
      ) : null}
    </Cartao>
  );
}
