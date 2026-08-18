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
  id           bigserial     primary key,
  nome         text          not null,
  fone         text          not null unique,
  cidade       text,
  revenda      text,
  frota        text,
  qtd_motos    text,
  comprador    text,
  marca_bau    text,
  marca_outra  text,
  ganhador     boolean       not null default false,
  ganhou_em    timestamptz,
  criado_em    timestamptz   not null default now()
);

-- Campos da ficha da revenda, acrescentados depois do evento piloto.
-- ADD COLUMN IF NOT EXISTS: quem ja tem a tabela antiga so ganha as colunas
-- novas (vazias nos registros ja gravados), sem perder nada.
alter table public.bau87_participantes add column if not exists revenda     text;
alter table public.bau87_participantes add column if not exists frota       text;
alter table public.bau87_participantes add column if not exists comprador   text;
alter table public.bau87_participantes add column if not exists marca_bau   text;
alter table public.bau87_participantes add column if not exists marca_outra text;

-- Faixa de frota ("1 a 10", "10 a 50", "50 a 100", "100+"), guardada como rotulo.
-- Registros antigos ficam nulos e o painel mostra "—".
alter table public.bau87_participantes add column if not exists qtd_motos   text;

-- Comprovante no WhatsApp: o watcher local (nakabox-bau87-watcher) manda UMA
-- mensagem por inscrito novo e fecha o registro aqui. Quem ja estava inscrito
-- antes do comprovante existir foi marcado como notificado, para nunca receber
-- mensagem de um cadastro antigo.
alter table public.bau87_participantes add column if not exists notificado_whatsapp boolean not null default false;
alter table public.bau87_participantes add column if not exists notificado_em       timestamptz;
alter table public.bau87_participantes add column if not exists notificado_erro     text;

-- ---------------------------------------------------------------------
-- Numero da ficha: sequencial, crescente, comecando em 1000.
--
-- Antes o numero era calculado na hora como 1000 + id. Agora ele mora numa
-- coluna propria, preenchida por uma SEQUENCE do Postgres — assim dois
-- cliques no mesmo segundo nunca tiram o mesmo numero, e apagar alguem da
-- lista nao devolve o numero dela para outra pessoa.
--
-- minvalue 999 existe so para o setval abaixo poder repousar em 999 quando a
-- tabela esta vazia; nesse caso o primeiro nextval devolve exatamente 1000.
create sequence if not exists public.bau87_ficha_seq as integer minvalue 999 start with 1000;

alter table public.bau87_participantes add column if not exists ficha_num integer;

-- Fichas que ja existiam NAO sao renumeradas: recebem exatamente 1000 + id,
-- que e o numero que aquela pessoa ja viu na tela.
update public.bau87_participantes set ficha_num = 1000 + id where ficha_num is null;

-- A sequencia repousa acima da maior ficha ja emitida (e nunca abaixo de 999),
-- entao a proxima inscricao pega um numero maior que todos e >= 1000.
select setval(
  'public.bau87_ficha_seq',
  greatest(999, coalesce((select max(ficha_num) from public.bau87_participantes), 999))
);

alter table public.bau87_participantes
  alter column ficha_num set default nextval('public.bau87_ficha_seq');
update public.bau87_participantes
  set ficha_num = nextval('public.bau87_ficha_seq') where ficha_num is null;
create unique index if not exists bau87_participantes_ficha_num_idx
  on public.bau87_participantes (ficha_num);
alter table public.bau87_participantes alter column ficha_num set not null;

-- Fila do comprovante: so interessa quem ainda nao recebeu.
create index if not exists bau87_participantes_notificado_idx
  on public.bau87_participantes (notificado_whatsapp) where notificado_whatsapp = false;

-- Consultas do painel: lista por ordem de inscricao e filtro de ganhadores.
create index if not exists bau87_participantes_ganhador_idx on public.bau87_participantes (ganhador);
create index if not exists bau87_participantes_criado_em_idx on public.bau87_participantes (criado_em);

-- RLS LIGADO e sem nenhuma policy de propósito.
-- O navegador nunca fala com o banco: quem acessa é a connection string,
-- usada só dentro das funções serverless em /api. Se um dia alguém expuser
-- uma chave anônima do Supabase, esta tabela continua fechada.
alter table public.bau87_participantes enable row level security;

-- O numero da ficha vem da coluna ficha_num (sequence bau87_ficha_seq, >= 1000).
-- A /api so poe o prefixo: ficha_num 1018 => 'NB-1018'.
--
-- "fone text not null unique" la em cima e a trava do numero repetido: a
-- segunda inscricao com o mesmo WhatsApp e recusada pelo banco (erro 23505),
-- que a /api traduz em HTTP 409 com a mensagem
-- "Este número já está inscrito no sorteio.".
