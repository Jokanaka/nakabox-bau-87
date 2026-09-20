"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { publicarAvistamento } from "@/actions/avistamentos";
import { dataUrlParaBlob, reduzirParaDataUrl } from "@/lib/imagem";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Identificacao } from "@/lib/tipos";
import {
  AvisoEnvio,
  Botao,
  Campo,
  Cartao,
  Erro,
  LinkBotao,
  Moldura,
  SeloCerteza,
  SeloTipo,
} from "@/components/ui";

type Etapa = "inicio" | "lendo" | "resultado";

export function Identificador({ logado }: { logado: boolean }) {
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [erro, setErro] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Identificacao | null>(null);

  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;

    setErro("");
    setResultado(null);
    setEtapa("lendo");

    try {
      const dataUrl = await reduzirParaDataUrl(arquivo);
      setFoto(dataUrl);

      const resposta = await fetch("/api/identificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagem: dataUrl }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não consegui ler esta foto.");
        setEtapa("inicio");
        return;
      }

      if (!dados.eh_imagem_religiosa) {
        setErro(
          "Esta foto não parece ser de uma imagem sacra católica. Tente enquadrar só a imagem, de frente e com boa luz.",
        );
        setEtapa("inicio");
        return;
      }

      setResultado(dados as Identificacao);
      setEtapa("resultado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado com a foto.");
      setEtapa("inicio");
    }
  }

  function recomecar() {
    setEtapa("inicio");
    setResultado(null);
    setFoto(null);
    setErro("");
  }

  if (etapa === "resultado" && resultado) {
    return (
      <Santinho
        resultado={resultado}
        foto={foto}
        logado={logado}
        aoRecomecar={recomecar}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-3xl text-azul sm:text-4xl">Quem é esta imagem?</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-suave">
          Fotografe a imagem de frente, com a peça inteira no quadro. O santinho
          vem com o nome, os sinais de reconhecimento e com quem ela costuma ser
          confundida.
        </p>
      </header>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={aoEscolher}
      />
      <input
        ref={galeria}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={aoEscolher}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Botao
          onClick={() => camera.current?.click()}
          disabled={etapa === "lendo"}
          className="w-full"
        >
          Tirar foto
        </Botao>
        <Botao
          variante="secundario"
          onClick={() => galeria.current?.click()}
          disabled={etapa === "lendo"}
          className="w-full"
        >
          Escolher da galeria
        </Botao>
      </div>

      {etapa === "lendo" ? (
        <p
          role="status"
          className="rounded-sm border border-borda bg-white px-4 py-6 text-center text-sm text-suave"
        >
          Lendo os sinais da imagem…
        </p>
      ) : null}

      <Erro>{erro}</Erro>
      <AvisoEnvio />

      <p className="text-center text-xs text-suave">
        Identificar não exige login.{" "}
        <Link href="/santos" className="text-azul underline underline-offset-4">
          Ou abra o livro dos santos
        </Link>
        .
      </p>
    </div>
  );
}

function Santinho({
  resultado,
  foto,
  logado,
  aoRecomecar,
}: {
  resultado: Identificacao;
  foto: string | null;
  logado: boolean;
  aoRecomecar: () => void;
}) {
  const [publicando, setPublicando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [local, setLocal] = useState("");
  const [erro, setErro] = useState("");
  const [publicado, setPublicado] = useState(false);

  async function publicar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!resultado.santo_id || !foto) {
      setErro("Faltou a identificação ou a foto.");
      return;
    }

    setPublicando(true);
    setErro("");

    try {
      const supabase = criarClienteNavegador();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErro("Sua sessão expirou. Entre de novo para publicar.");
        setPublicando(false);
        return;
      }

      const caminho = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: erroUpload } = await supabase.storage
        .from("avistamentos")
        .upload(caminho, dataUrlParaBlob(foto), {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (erroUpload) {
        setErro(`Não consegui subir a foto: ${erroUpload.message}`);
        setPublicando(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avistamentos").getPublicUrl(caminho);

      const r = await publicarAvistamento({
        santo_id: resultado.santo_id,
        foto_url: publicUrl,
        local_nome: local,
      });

      if (!r.ok) {
        setErro(r.erro);
        setPublicando(false);
        return;
      }

      setPublicado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado ao publicar.");
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Cartao className="space-y-4">
        <div className="text-center">
          <div className="mx-auto max-w-[15rem]">
            <Moldura src={foto} alt={resultado.nome} prioridade />
          </div>

          <h1 className="mt-4 text-3xl leading-tight text-azul">{resultado.nome}</h1>

          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <SeloTipo tipo={resultado.tipo} />
            <SeloCerteza certeza={resultado.certeza} />
          </div>
        </div>

        <div className="space-y-3">
          <Campo rotulo="Quem é">{resultado.descricao}</Campo>

          {resultado.sinais.length > 0 ? (
            <Campo rotulo="Como reconhecer">
              <ul className="list-disc space-y-0.5 pl-5">
                {resultado.sinais.map((sinal) => (
                  <li key={sinal}>{sinal}</li>
                ))}
              </ul>
            </Campo>
          ) : null}

          <Campo rotulo="Festa">{resultado.festa}</Campo>
          <Campo rotulo="Padroeiro">{resultado.padroeiro}</Campo>
          <Campo rotulo="Não confunda">{resultado.confusao}</Campo>

          {resultado.alternativas.length > 0 ? (
            <Campo rotulo="Também poderia ser">
              {resultado.alternativas.join(" · ")}
            </Campo>
          ) : null}
        </div>

        {resultado.certeza === "baixa" ? (
          <p className="rounded-sm border border-dourado-claro bg-[#fdf9ef] px-3 py-2 text-xs leading-relaxed text-dourado">
            A certeza ficou baixa. Confira os sinais antes de tomar esta
            identificação como certa — e corrija o verbete se souber mais.
          </p>
        ) : null}
      </Cartao>

      {publicado ? (
        <Cartao className="space-y-3 text-center">
          <p className="text-sm text-tinta">Avistamento publicado.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <LinkBotao href="/feed" variante="principal">
              Ver no feed
            </LinkBotao>
            <Botao variante="secundario" onClick={aoRecomecar}>
              Identificar outra
            </Botao>
          </div>
        </Cartao>
      ) : (
        <Cartao className="space-y-3">
          {!aberto ? (
            <div className="flex flex-wrap gap-2">
              <Botao onClick={() => setAberto(true)} className="flex-1">
                Publicar avistamento
              </Botao>
              <Botao variante="secundario" onClick={aoRecomecar} className="flex-1">
                Identificar outra
              </Botao>
            </div>
          ) : logado ? (
            <form onSubmit={publicar} className="space-y-3">
              <div>
                <label
                  htmlFor="local"
                  className="versalete block text-[0.7rem] text-dourado"
                >
                  Onde você viu
                </label>
                <input
                  id="local"
                  name="local"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="off"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Igreja de Santa Cecília, São Paulo"
                  className="mt-1 min-h-11 w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-suave">
                  É só isto que pedimos. O santo vem da identificação.
                </p>
              </div>

              <AvisoEnvio />

              <div className="flex flex-wrap gap-2">
                <Botao type="submit" disabled={publicando} className="flex-1">
                  {publicando ? "Publicando…" : "Publicar"}
                </Botao>
                <Botao
                  type="button"
                  variante="secundario"
                  onClick={() => setAberto(false)}
                  disabled={publicando}
                >
                  Cancelar
                </Botao>
              </div>

              <Erro>{erro}</Erro>
            </form>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-suave">
                Publicar exige login. Identificar, não.
              </p>
              <LinkBotao href="/entrar" variante="principal">
                Entrar para publicar
              </LinkBotao>
            </div>
          )}

          {resultado.santo_id ? (
            <p className="text-center text-xs text-suave">
              <Link
                href={`/santos/${resultado.slug}`}
                className="text-azul underline underline-offset-4"
              >
                Abrir o verbete de {resultado.nome}
              </Link>
              {resultado.verbete_novo
                ? " — criado agora pela identificação, aguardando revisão da comunidade."
                : null}
            </p>
          ) : null}
        </Cartao>
      )}
    </div>
  );
}
