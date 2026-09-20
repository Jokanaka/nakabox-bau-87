"use client";

import { useActionState, useState } from "react";

import { criarTopico, responder, type ResultadoAcao } from "@/actions/forum";
import { Botao, Cartao, Erro } from "@/components/ui";
import type { Santo } from "@/lib/tipos";

const estiloEntrada =
  "mt-1 min-h-11 w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm leading-relaxed";

export function FormTopico({
  santos,
}: {
  santos: Pick<Santo, "id" | "slug" | "nome">[];
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(
    criarTopico,
    null,
  );

  if (!aberto) {
    return (
      <Botao onClick={() => setAberto(true)} className="w-full sm:w-auto">
        Abrir um assunto
      </Botao>
    );
  }

  return (
    <Cartao>
      <form action={acao} className="space-y-3">
        <div>
          <label htmlFor="titulo" className="versalete text-[0.7rem] text-dourado">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            required
            minLength={3}
            maxLength={160}
            autoComplete="off"
            className={estiloEntrada}
          />
        </div>

        <div>
          <label htmlFor="corpo" className="versalete text-[0.7rem] text-dourado">
            Assunto
          </label>
          <textarea
            id="corpo"
            name="corpo"
            required
            rows={6}
            maxLength={8000}
            className={estiloEntrada}
          />
        </div>

        <div>
          <label htmlFor="santo_id" className="versalete text-[0.7rem] text-dourado">
            Sobre um santo (opcional)
          </label>
          <select
            id="santo_id"
            name="santo_id"
            defaultValue=""
            className={estiloEntrada}
          >
            <option value="">Nenhum em especial</option>
            {santos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Botao type="submit" disabled={pendente} className="flex-1">
            {pendente ? "Publicando…" : "Publicar assunto"}
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            onClick={() => setAberto(false)}
            disabled={pendente}
          >
            Cancelar
          </Botao>
        </div>

        {estado && !estado.ok ? <Erro>{estado.erro}</Erro> : null}
      </form>
    </Cartao>
  );
}

export function FormResposta({ topicoId }: { topicoId: string }) {
  const [estado, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(
    responder,
    null,
  );

  return (
    <Cartao>
      <form action={acao} className="space-y-3" key={estado?.ok ? "limpo" : "ativo"}>
        <input type="hidden" name="topico_id" value={topicoId} />

        <div>
          <label htmlFor="resposta" className="versalete text-[0.7rem] text-dourado">
            Responder
          </label>
          <textarea
            id="resposta"
            name="corpo"
            required
            rows={4}
            maxLength={8000}
            className={estiloEntrada}
          />
        </div>

        <Botao type="submit" disabled={pendente}>
          {pendente ? "Enviando…" : "Responder"}
        </Botao>

        {estado && !estado.ok ? <Erro>{estado.erro}</Erro> : null}
      </form>
    </Cartao>
  );
}
