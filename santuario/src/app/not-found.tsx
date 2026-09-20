import { LinkBotao } from "@/components/ui";

export default function NaoEncontrado() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-3xl text-azul">Não encontrei esta página</h1>
      <p className="text-sm text-suave">
        O verbete pode ter mudado de nome, ou o endereço veio errado.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <LinkBotao href="/santos" variante="principal">
          Abrir o livro
        </LinkBotao>
        <LinkBotao href="/">Identificar uma imagem</LinkBotao>
      </div>
    </div>
  );
}
