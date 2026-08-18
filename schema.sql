-- =====================================================================
-- NAKABOX — Sorteio de eventos (baú 87)
--
-- Banco: Postgres (o mesmo Postgres que a Nakabox já usa; a conexão vem
-- da variável de ambiente DATABASE_URL). Rode este arquivo UMA vez, no
-- SQL Editor do Supabase ou por `psql "$DATABASE_URL" -f schema.sql`.
--
-- Todas as tabelas deste app começam com o prefixo `bau87_` para não
-- encostar em nenhuma tabela dos outros sistemas que dividem o banco.
-- =====================================================================

create table if not exists public.bau87_participantes (
  id         bigserial     primary key,
  nome       text          not null,
  fone       text          not null unique,
  cidade     text,
  ganhador   boolean       not null default false,
  ganhou_em  timestamptz,
  criado_em  timestamptz   not null default now()
);

-- Consultas do painel: lista por ordem de inscricao e filtro de ganhadores.
create index if not exists bau87_participantes_ganhador_idx on public.bau87_participantes (ganhador);
create index if not exists bau87_participantes_criado_em_idx on public.bau87_participantes (criado_em);

-- RLS LIGADO e sem nenhuma policy de propósito.
-- O navegador nunca fala com o banco: quem acessa é a connection string,
-- usada só dentro das funções serverless em /api. Se um dia alguém expuser
-- uma chave anônima do Supabase, esta tabela continua fechada.
alter table public.bau87_participantes enable row level security;

-- O numero da ficha e derivado do id, sem coluna extra: 'NB-' || (1000 + id).
-- Ex.: id 7 => ficha NB-1007. Quem monta essa string e a funcao /api, nunca o banco.
