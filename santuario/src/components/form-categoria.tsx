"use client";

import { useActionState } from "react";
import Link from "next/link";

import { vincularCategoria, type ResultadoAcao } from "@/actions/santos";
import { Botao, Cartao, Erro } from "@/components/ui";
import type { Categoria } from "@/lib/tipos";

export function FormCategoria({
  santoId,
  slug,
  logado,
  categorias,
  jaVinculadas,
}: {
  santoId: string;
  slug: string;
  logado: boolean;
  categorias: Categoria[];
  jaVinculadas: string[];
}) {
  const [estado, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(
    vincularCategoria,
    null,
  );

  const disponiveis = categorias.filter((c) => !jaVinculadas.includes(c.id));

  if (!logado) {
    return (
      <p className="text-xs text-suave">
        <Link href="/entrar" className="text-azul underline underline-offset-4">
          Entre
        </Link>{" "}
        para classificar este verbete numa categoria.
      </p>
    );
  }

  return (
    <Cartao className="space-y-3">
      <h2 className="versalete text-[0.7rem] text-dourado">Classificar</h2>

      <form action={acao} className="space-y-3">
        <input type="hidden" name="santo_id" value={santoId} />
        <input type="hidden" name="slug" value={slug} />

        {disponiveis.length > 0 ? (
          <div>
            <label htmlFor="categoria_id" className="sr-only">
              Categoria existente
            </label>
            <select
              id="categoria_id"
              name="categoria_id"
              defaultValue=""
              className="min-h-11 w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm"
            >
              <option value="">Escolha uma categoria…</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="categoria_nova" className="sr-only">
            Criar categoria
          </label>
          <input
            id="categoria_nova"
            name="categoria_nova"
            maxLength={80}
            autoComplete="off"
            placeholder="…ou crie uma nova: Mártires, Padroeiros de cidade…"
            className="min-h-11 w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm"
          />
        </div>

        <Botao type="submit" variante="secundario" disabled={pendente}>
          {pendente ? "Salvando…" : "Adicionar categoria"}
        </Botao>

        {estado && !estado.ok ? <Erro>{estado.erro}</Erro> : null}
        {estado?.ok ? (
          <p className="text-xs text-dourado">Categoria adicionada.</p>
        ) : null}
      </form>
    </Cartao>
  );
}
