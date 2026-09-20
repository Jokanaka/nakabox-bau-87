# Santuário

Site em português do Brasil, na perspectiva católica apostólica romana, com
quatro partes:

1. **Identificar** — a pessoa fotografa uma imagem sacra e recebe um santinho
   com nome, tipo, quem é, como reconhecer, festa, padroeiro e com quem não
   confundir.
2. **O livro dos santos** — enciclopédia editável, com categorias criadas pela
   comunidade, histórico de edições e ranking dos mais escaneados.
3. **Avistamentos** — feed cronológico só de imagens sacras. Quem publica
   informa **apenas o nome do local**; o santo vem da identificação.
4. **Fórum** — fechado: sem login, nem a leitura passa.

Projeto de Joaquim Nakamura, São Paulo.

## Stack

Tudo em camada gratuita, sem cartão de crédito:

| Peça | Serviço | Plano |
|---|---|---|
| App | Next.js 15 (App Router, TypeScript) + Tailwind 4 | — |
| Banco, Auth e Storage | Supabase | Free |
| Identificação por foto | Google Gemini (`gemini-2.5-flash`) | Camada gratuita do AI Studio |
| Hospedagem | Vercel | Hobby |

A chave do Gemini e a service role do Supabase só existem no servidor — nunca
são enviadas ao navegador.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODELO=          # opcional, padrão gemini-2.5-flash
```

- Supabase: *Project Settings → API*.
- Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) —
  criar a chave é grátis e não pede cartão.

## Como subir do zero

### 1. Banco

No SQL Editor do Supabase, rode nesta ordem:

1. `supabase/schema.sql` — cria as tabelas, liga **RLS em todas elas**, cria o
   gatilho de histórico, as RPCs de edição/reversão e o bucket `avistamentos`.
2. `supabase/seed.sql` — cria os quatro verbetes do acervo e as categorias.

O `seed.sql` é idempotente: pode rodar quantas vezes quiser.

O acervo são quatro imagens fotografadas pelo dono do projeto na mesma
igreja: **Nossa Senhora da Paz**, **São José**, **São Miguel Arcanjo** e o
**Sagrado Coração de Jesus**. As fotos já estão em `public/seed/` e os
avistamentos iniciais entram sem autor, como avistamentos da casa.

> Na foto de Nossa Senhora da Paz há uma pessoa desfocada no canto inferior
> esquerdo. **O desfoque faz parte do arquivo e precisa continuar assim.**

Antes de rodar o seed, troque o local no fim de `supabase/seed.sql` —
hoje está `'Paróquia (definir nome), São Paulo'` — pelo nome real da igreja.

### 2. Rodar local

```bash
npm install
npm run dev
```

### 3. Deploy na Vercel

O app fica na subpasta `santuario/`, então o **Root Directory** do projeto na
Vercel precisa apontar para ela.

```bash
npm i -g vercel
vercel link            # em santuario/, com Root Directory = santuario
vercel env add GEMINI_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel --prod
```

Depois do primeiro deploy, no Supabase em *Authentication → URL Configuration*,
inclua a URL de produção em **Site URL** e em **Redirect URLs** adicione
`https://SEU-DOMINIO/auth/callback` — sem isso o link mágico volta para
`localhost`.

## Testes

As regras que não podem quebrar são verificadas contra um Postgres de
verdade, não só por inspeção. Num banco vazio (**não** o de produção):

```bash
psql -v ON_ERROR_STOP=1 -f supabase/testes/harness.sql   # arremedo do Supabase
psql -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -f supabase/testes/testes.sql
```

Esperado: **16 PASSOU, 0 FALHOU**. A suíte conta linhas, então só vale num
banco recém-semeado — rodar duas vezes para na trava com um aviso, em vez de
dar falso negativo.

## Regras que o código garante

- **Publicar avistamento pede só o nome do local.** O formulário não tem outro
  campo; o santo vem de `santo_id` da identificação.
- **O fórum é privado.** As policies de `forum_topicos` e `forum_respostas` são
  `to authenticated` inclusive no `SELECT`, e as páginas redirecionam para
  `/entrar`. Não é só a interface que esconde.
- **Toda edição de verbete grava em `edicoes`.** Quem grava é um gatilho
  `AFTER UPDATE` em `santos`, não o código do app — então nenhuma alteração
  escapa, venha ela da RPC, do SQL Editor ou de onde for. Nada é apagado:
  reverter grava uma **nova** entrada com a versão antiga de volta.
- **Aviso no envio:** "Publique só fotos tiradas por você. Evite rostos de
  pessoas." aparece na tela de identificação e no formulário de publicação.
- **Identificar não exige login.** Publicar, editar e o fórum exigem.
- **O histórico não pode ser apagado, adulterado nem forjado**, e **o ranking
  não pode ser inflado pelo navegador**: além da RLS, `edicoes` e `scans` têm
  `INSERT`/`UPDATE`/`DELETE` revogados de `anon` e `authenticated`. Sem policy
  a RLS bloquearia em silêncio, afetando zero linhas; o revoke faz falhar com
  erro e continua valendo se um dia alguém desligar a RLS por engano. Quem
  escreve em `edicoes` é o gatilho, e em `scans` é o servidor — ambos com
  privilégio próprio.
- **20 identificações por IP por hora**, contadas na tabela `identificacao_ip`
  (o IP é guardado só como hash com sal). A contagem vive no banco porque cada
  chamada na Vercel roda num processo diferente.
- **Responsivo, pensado primeiro para celular**, e `prefers-reduced-motion` é
  respeitado em `globals.css`.

## Estrutura

```
src/
  app/
    page.tsx                  identificar
    santos/                   o livro, o verbete, o histórico e a edição
    feed/                     avistamentos
    forum/                    fórum privado
    entrar/                   login por link mágico
    auth/callback|sair/       troca do código pela sessão, e saída
    api/identificar/          chamada ao Gemini, scan e criação do verbete
  actions/                    server actions (avistamentos, santos, fórum)
  components/                 interface
  lib/                        clientes Supabase, tipos, limite por IP, imagem
supabase/
  schema.sql                  tabelas, RLS, gatilhos, RPCs, bucket
  seed.sql                    acervo inicial
```

## O que a identificação faz

`POST /api/identificar` recebe a foto em base64 (o navegador já reduz para no
máximo 1600 px), chama o Gemini com esquema de resposta fixo e então:

1. grava um registro em `scans` — mesmo sem login e mesmo que a pessoa não
   publique, porque é isso que alimenta o ranking;
2. se o `slug` já existe em `santos`, vincula o scan ao verbete;
3. se não existe, cria o verbete com `origem = 'ia'` e o selo
   *aguardando revisão da comunidade*.
