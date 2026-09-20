"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { reverterEdicao } from "@/actions/santos";
import { Botao, Erro } from "@/components/ui";

export function BotaoReverter({
  edicaoId,
  slug,
}: {
  edicaoId: string;
  slug: string;
}) {
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-1.5">
      <Botao
        variante="secundario"
        disabled={pendente}
        className="!min-h-0 !px-3 !py-1.5 !text-xs"
        onClick={() =>
          iniciar(async () => {
            setErro("");
            const r = await reverterEdicao(edicaoId, slug);
            if (r.ok) router.refresh();
            else setErro(r.erro);
          })
        }
      >
        {pendente ? "Revertendo…" : "Reverter para esta versão"}
      </Botao>
      <Erro>{erro}</Erro>
    </div>
  );
}
