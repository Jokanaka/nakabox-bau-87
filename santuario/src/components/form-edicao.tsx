"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { salvarEdicao, type ResultadoAcao } from "@/actions/santos";
import { Botao, Cartao, Erro, LinkBotao } from "@/components/ui";
import { ROTULO_TIPO, TIPOS, type Santo } from "@/lib/tipos";

export function FormEdicao({ santo }: { santo: Santo }) {
  const [estado, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(
    salvarEdicao,
    null,
  );
  const router = useRouter();

  const sinaisTexto = santo.sinais.join("\n");

  useEffect(() => {
    if (estado?.ok) router.push(`/santos/${santo.slug}`);
  }, [estado, router, santo.slug]);

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="santo_id" value={santo.id} />
      <input type="hidden" name="slug" value={santo.slug} />

      <Cartao className="space-y-4">
        <Linha rotulo="Nome" htmlFor="campo_nome">
          <input
            id="campo_nome"
            name="campo_nome"
            defaultValue={santo.nome}
            required
            maxLength={160}
            className={estiloEntrada}
          />
          <input type="hidden" name="original_nome" value={santo.nome} />
        </Linha>

        <Linha
          rotulo="Tipo"
          htmlFor="campo_tipo"
          ajuda="Advocações de Nossa Senhora e representações de Cristo não são santos."
        >
          <select
            id="campo_tipo"
            name="campo_tipo"
            defaultValue={santo.tipo}
            className={estiloEntrada}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </select>
          <input type="hidden" name="original_tipo" value={santo.tipo} />
        </Linha>

        <Linha rotulo="Quem é" htmlFor="campo_resumo" ajuda="2 a 4 frases.">
          <textarea
            id="campo_resumo"
            name="campo_resumo"
            defaultValue={santo.resumo ?? ""}
            rows={5}
            maxLength={2000}
            className={estiloEntrada}
          />
          <input type="hidden" name="original_resumo" value={santo.resumo ?? ""} />
        </Linha>

        <Linha
          rotulo="Como reconhecer"
          htmlFor="campo_sinais"
          ajuda="Um sinal por linha."
        >
          <textarea
            id="campo_sinais"
            name="campo_sinais"
            defaultValue={sinaisTexto}
            rows={6}
            className={estiloEntrada}
          />
          <input type="hidden" name="original_sinais" value={sinaisTexto} />
        </Linha>

        <Linha rotulo="Festa" htmlFor="campo_festa">
          <input
            id="campo_festa"
            name="campo_festa"
            defaultValue={santo.festa ?? ""}
            maxLength={200}
            className={estiloEntrada}
          />
          <input type="hidden" name="original_festa" value={santo.festa ?? ""} />
        </Linha>

        <Linha rotulo="Padroeiro" htmlFor="campo_padroeiro">
          <input
            id="campo_padroeiro"
            name="campo_padroeiro"
            defaultValue={santo.padroeiro ?? ""}
            maxLength={300}
            className={estiloEntrada}
          />
          <input
            type="hidden"
            name="original_padroeiro"
            value={santo.padroeiro ?? ""}
          />
        </Linha>

        <Linha
          rotulo="Não confunda"
          htmlFor="campo_confusao"
          ajuda="Com quem se confunde e como diferenciar."
        >
          <textarea
            id="campo_confusao"
            name="campo_confusao"
            defaultValue={santo.confusao ?? ""}
            rows={4}
            maxLength={2000}
            className={estiloEntrada}
          />
          <input
            type="hidden"
            name="original_confusao"
            value={santo.confusao ?? ""}
          />
        </Linha>
      </Cartao>

      <Cartao className="space-y-3">
        <Linha
          rotulo="Justificativa"
          htmlFor="justificativa"
          ajuda="Por que a mudança? Fica registrada no histórico."
        >
          <input
            id="justificativa"
            name="justificativa"
            required
            minLength={3}
            maxLength={300}
            autoComplete="off"
            placeholder="Corrigi a data da festa conforme o martirológio"
            className={estiloEntrada}
          />
        </Linha>

        <div className="flex flex-wrap gap-2">
          <Botao type="submit" disabled={pendente} className="flex-1">
            {pendente ? "Salvando…" : "Salvar alterações"}
          </Botao>
          <LinkBotao href={`/santos/${santo.slug}`}>Cancelar</LinkBotao>
        </div>

        {estado && !estado.ok ? <Erro>{estado.erro}</Erro> : null}
      </Cartao>
    </form>
  );
}

const estiloEntrada =
  "mt-1 min-h-11 w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm leading-relaxed";

function Linha({
  rotulo,
  htmlFor,
  ajuda,
  children,
}: {
  rotulo: string;
  htmlFor: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-borda pt-3 first:border-t-0 first:pt-0">
      <label htmlFor={htmlFor} className="versalete text-[0.7rem] text-dourado">
        {rotulo}
      </label>
      {children}
      {ajuda ? <p className="mt-1 text-xs text-suave">{ajuda}</p> : null}
    </div>
  );
}
