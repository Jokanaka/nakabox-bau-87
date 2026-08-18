-- =====================================================================
-- NAKABOX — Sorteio de eventos
-- Rode este arquivo no SQL Editor do Supabase (Database > SQL Editor).
-- =====================================================================

create table if not exists public.inscritos (
  id         bigserial     primary key,
  nome       text          not null,
  fone       text          not null unique,
  cidade     text,
  ganhador   boolean       not null default false,
  ganhou_em  timestamptz,
  criado_em  timestamptz   not null default now()
);

-- Consultas do painel: lista por ordem de inscricao e filtro de ganhadores.
create index if not exists inscritos_ganhador_idx on public.inscritos (ganhador);
create index if not exists inscritos_criado_em_idx on public.inscritos (criado_em);

-- RLS LIGADO e sem nenhuma policy de propósito.
-- O navegador nunca fala com o banco direto: quem acessa é a service key,
-- usada só dentro das funções serverless em /api, e a service key ignora RLS.
-- Assim, se a chave anônima vazar, ninguém lê nem escreve nada nesta tabela.
alter table public.inscritos enable row level security;

-- O numero da ficha e derivado do id, sem coluna extra: 'NB-' || (1000 + id).
-- Ex.: id 7 => ficha NB-1007. Quem monta essa string e a funcao /api, nunca o banco.
