import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Karla } from "next/font/google";
import Link from "next/link";

import "./globals.css";
import { usuarioAtual } from "@/lib/supabase/server";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fonte-titulo",
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fonte-texto",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Santuário",
    template: "%s · Santuário",
  },
  description:
    "Identifique imagens sacras pela foto, consulte o livro dos santos e acompanhe os avistamentos da comunidade.",
};

export const viewport: Viewport = {
  themeColor: "#eef3f9",
  width: "device-width",
  initialScale: 1,
};

const LINKS = [
  { href: "/", rotulo: "Identificar" },
  { href: "/santos", rotulo: "O livro" },
  { href: "/feed", rotulo: "Avistamentos" },
  { href: "/forum", rotulo: "Fórum" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await usuarioAtual().catch(() => null);

  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${karla.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-sm focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
        >
          Pular para o conteúdo
        </a>

        <header className="border-b border-borda bg-pergaminho">
          <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link href="/" className="no-underline">
                <span className="block font-titulo text-2xl leading-none text-azul">
                  Santuário
                </span>
                <span className="versalete text-[0.68rem] text-suave">
                  Iconografia católica
                </span>
              </Link>

              {usuario ? (
                <form action="/auth/sair" method="post">
                  <button
                    type="submit"
                    className="versalete cursor-pointer text-[0.7rem] text-suave underline underline-offset-4 hover:text-azul"
                  >
                    Sair
                  </button>
                </form>
              ) : (
                <Link
                  href="/entrar"
                  className="versalete text-[0.7rem] text-suave underline underline-offset-4 hover:text-azul"
                >
                  Entrar
                </Link>
              )}
            </div>

            <nav aria-label="Seções" className="mt-3 -mx-1 overflow-x-auto">
              <ul className="flex items-center gap-1 text-sm whitespace-nowrap">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-full px-3 py-1.5 text-suave no-underline hover:bg-azul-claro hover:text-azul"
                    >
                      {link.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-dourado-claro to-transparent" />
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>

        <footer className="mt-8 border-t border-borda bg-pergaminho">
          <div className="mx-auto w-full max-w-3xl px-4 py-5 text-xs leading-relaxed text-suave">
            <p>
              Santuário — projeto de Joaquim Nakamura, São Paulo. Os verbetes são
              escritos e corrigidos pela comunidade; toda alteração fica registrada
              no histórico.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
