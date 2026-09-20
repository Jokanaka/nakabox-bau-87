import Link from "next/link";
import { ROTULO_TIPO, type Certeza, type Tipo } from "@/lib/tipos";

export function Selo({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: "neutro" | "dourado" | "azul" | "atencao";
}) {
  const tons = {
    neutro: "border-borda bg-white text-suave",
    dourado: "border-dourado-claro bg-[#fdf9ef] text-dourado",
    azul: "border-azul-claro bg-azul-claro text-azul",
    atencao: "border-dourado-claro bg-[#fdf6e6] text-dourado",
  } as const;

  return (
    <span
      className={`versalete inline-block rounded-full border px-2.5 py-0.5 text-[0.68rem] ${tons[tom]}`}
    >
      {children}
    </span>
  );
}

export function SeloTipo({ tipo }: { tipo: Tipo }) {
  return <Selo tom="azul">{ROTULO_TIPO[tipo]}</Selo>;
}

export function SeloCerteza({ certeza }: { certeza: Certeza }) {
  return (
    <Selo tom={certeza === "alta" ? "dourado" : "neutro"}>
      certeza {certeza}
    </Selo>
  );
}

export function SeloRevisao() {
  return <Selo tom="atencao">aguardando revisão da comunidade</Selo>;
}

/**
 * Foto com moldura. Quando não há arquivo — ou o arquivo ainda não foi
 * copiado para public/seed — mostra uma moldura com o nome, nunca um erro.
 */
export function Moldura({
  src,
  alt,
  proporcao = "aspect-[4/5]",
  prioridade,
}: {
  src: string | null;
  alt: string;
  proporcao?: string;
  prioridade?: boolean;
}) {
  return (
    <div
      className={`filete relative ${proporcao} w-full overflow-hidden rounded-sm border border-dourado-claro bg-pergaminho`}
    >
      {src ? (
        // Sem next/image: as fotos vêm do Storage do Supabase e de
        // /seed, e o fallback abaixo precisa funcionar sem configuração.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={prioridade ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      {!src ? (
        <div className="absolute inset-0 grid place-items-center px-4 text-center">
          <span className="font-titulo text-lg text-suave">{alt}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Cartao({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`filete rounded-sm border border-borda bg-white p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  if (children === null || children === undefined || children === "") return null;

  return (
    <div className="border-t border-borda pt-3 first:border-t-0 first:pt-0">
      <h3 className="versalete text-[0.7rem] text-dourado">{rotulo}</h3>
      <div className="mt-1 text-[0.95rem] leading-relaxed text-tinta">{children}</div>
    </div>
  );
}

export function Botao({
  children,
  variante = "principal",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principal" | "secundario";
}) {
  const estilos = {
    principal:
      "bg-azul text-white hover:bg-[#233c5e] disabled:bg-suave disabled:opacity-60",
    secundario:
      "border border-borda bg-white text-tinta hover:border-dourado-claro hover:bg-pergaminho disabled:opacity-60",
  } as const;

  return (
    <button
      {...props}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sm px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkBotao({
  href,
  children,
  variante = "secundario",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variante?: "principal" | "secundario";
  className?: string;
}) {
  const estilos = {
    principal: "bg-azul text-white hover:bg-[#233c5e]",
    secundario:
      "border border-borda bg-white text-tinta hover:border-dourado-claro hover:bg-pergaminho",
  } as const;

  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center rounded-sm px-4 py-2.5 text-sm font-medium no-underline transition-colors ${estilos[variante]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function AvisoEnvio() {
  return (
    <p className="rounded-sm border border-dourado-claro bg-[#fdf9ef] px-3 py-2 text-xs leading-relaxed text-dourado">
      Publique só fotos tiradas por você. Evite rostos de pessoas.
    </p>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-dashed border-borda px-4 py-8 text-center text-sm text-suave">
      {children}
    </p>
  );
}

export function Erro({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-sm border border-[#d8b4b4] bg-[#fdf3f3] px-3 py-2 text-sm text-[#8a3a3a]"
    >
      {children}
    </p>
  );
}

export function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
