"use client";

import { useState } from "react";

import { criarClienteNavegador } from "@/lib/supabase/client";
import { Botao, Cartao, Erro } from "@/components/ui";

export function FormEntrar({
  destino,
  aviso,
}: {
  destino: string;
  aviso: string;
}) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(aviso);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro("");

    try {
      const supabase = criarClienteNavegador();
      const retorno = new URL("/auth/callback", window.location.origin);
      retorno.searchParams.set("destino", destino);

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: retorno.toString() },
      });

      if (error) setErro(error.message);
      else setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui enviar o link.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <Cartao className="space-y-2 text-center">
        <h2 className="text-xl text-azul">Link enviado</h2>
        <p className="text-sm leading-relaxed text-suave">
          Abra o e-mail que acabou de chegar em <strong>{email}</strong> e clique
          no link. Ele vale por pouco tempo.
        </p>
      </Cartao>
    );
  }

  return (
    <Cartao>
      <form onSubmit={enviar} className="space-y-3">
        <div>
          <label htmlFor="email" className="versalete text-[0.7rem] text-dourado">
            Seu e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="mt-1 min-h-11 w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm"
          />
        </div>

        <Botao type="submit" disabled={enviando} className="w-full">
          {enviando ? "Enviando…" : "Receber link por e-mail"}
        </Botao>

        <Erro>{erro}</Erro>
      </form>
    </Cartao>
  );
}
