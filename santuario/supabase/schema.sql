-- =====================================================================
-- SANTUÁRIO — esquema do banco
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
-- Depois rode supabase/seed.sql.
--
-- RLS está LIGADA em todas as tabelas. A chave anônima só faz o que as
-- policies abaixo permitem. A service role (usada apenas no servidor,
-- em /api/identificar) passa por cima da RLS — por isso ela nunca vai
-- para o navegador.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- santos — o verbete
-- ---------------------------------------------------------------------
create table if not exists public.santos (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  nome          text not null,
  tipo          text not null check (tipo in ('nossa_senhora','santo','santa','cristo','anjo','cena')),
  resumo        text,
  sinais        text[] not null default '{}',
  festa         text,
  padroeiro     text,
  confusao      text,
  origem        text not null default 'comunidade' check (origem in ('seed','ia','comunidade')),
  foto_capa     text,
  atualizado_em timestamptz not null default now()
);

create index if not exists santos_nome_idx on public.santos (nome);
create index if not exists santos_tipo_idx on public.santos (tipo);

-- ---------------------------------------------------------------------
-- categorias — criadas pelos usuários (Arcanjos, Advocações marianas, ...)
-- ---------------------------------------------------------------------
create table if not exists public.categorias (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  nome      text not null,
  descricao text,
  autor_id  uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.santo_categoria (
  santo_id     uuid not null references public.santos (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  primary key (santo_id, categoria_id)
);

create index if not exists santo_categoria_categoria_idx on public.santo_categoria (categoria_id);

-- ---------------------------------------------------------------------
-- edicoes — histórico estilo wiki. Nada aqui é apagado nem alterado.
-- ---------------------------------------------------------------------
create table if not exists public.edicoes (
  id             uuid primary key default gen_random_uuid(),
  santo_id       uuid not null references public.santos (id) on delete cascade,
  autor_id       uuid references auth.users (id) on delete set null,
  campo          text not null,
  valor_anterior text,
  valor_novo     text,
  justificativa  text,
  criado_em      timestamptz not null default now()
);

create index if not exists edicoes_santo_idx on public.edicoes (santo_id, criado_em desc);

-- ---------------------------------------------------------------------
-- avistamentos — o feed. O usuário informa APENAS o nome do local.
-- ---------------------------------------------------------------------
create table if not exists public.avistamentos (
  id         uuid primary key default gen_random_uuid(),
  santo_id   uuid not null references public.santos (id) on delete cascade,
  autor_id   uuid not null references auth.users (id) on delete cascade,
  foto_url   text not null,
  local_nome text not null check (char_length(trim(local_nome)) between 2 and 120),
  criado_em  timestamptz not null default now()
);

create index if not exists avistamentos_criado_idx on public.avistamentos (criado_em desc);
create index if not exists avistamentos_santo_idx on public.avistamentos (santo_id, criado_em desc);

-- ---------------------------------------------------------------------
-- scans — um registro por identificação, mesmo sem publicação.
-- Alimenta o ranking "Mais escaneados".
-- ---------------------------------------------------------------------
create table if not exists public.scans (
  id        uuid primary key default gen_random_uuid(),
  santo_id  uuid not null references public.santos (id) on delete cascade,
  autor_id  uuid references auth.users (id) on delete set null,
  certeza   text check (certeza in ('alta','média','baixa')),
  criado_em timestamptz not null default now()
);

create index if not exists scans_santo_idx on public.scans (santo_id);

-- ---------------------------------------------------------------------
-- fórum — privado: leitura e escrita só para authenticated
-- ---------------------------------------------------------------------
create table if not exists public.forum_topicos (
  id        uuid primary key default gen_random_uuid(),
  autor_id  uuid not null references auth.users (id) on delete cascade,
  santo_id  uuid references public.santos (id) on delete set null,
  titulo    text not null check (char_length(trim(titulo)) between 3 and 160),
  corpo     text not null check (char_length(trim(corpo)) between 1 and 8000),
  criado_em timestamptz not null default now()
);

create index if not exists forum_topicos_criado_idx on public.forum_topicos (criado_em desc);

create table if not exists public.forum_respostas (
  id        uuid primary key default gen_random_uuid(),
  topico_id uuid not null references public.forum_topicos (id) on delete cascade,
  autor_id  uuid not null references auth.users (id) on delete cascade,
  corpo     text not null check (char_length(trim(corpo)) between 1 and 8000),
  criado_em timestamptz not null default now()
);

create index if not exists forum_respostas_topico_idx on public.forum_respostas (topico_id, criado_em);

-- ---------------------------------------------------------------------
-- controle de custo: 20 identificações por IP por hora.
-- Gravada e lida somente pelo servidor (service role). Sem policy = a
-- chave anônima não enxerga nada.
-- ---------------------------------------------------------------------
create table if not exists public.identificacao_ip (
  id        bigserial primary key,
  ip_hash   text not null,
  criado_em timestamptz not null default now()
);

create index if not exists identificacao_ip_idx on public.identificacao_ip (ip_hash, criado_em desc);

-- =====================================================================
-- Histórico automático: TODA alteração em santos grava em edicoes.
-- O gatilho é o único autor de edicoes, então nenhuma edição escapa,
-- venha ela da RPC, do SQL Editor ou de qualquer outro caminho.
-- =====================================================================
create or replace function public.santos_registrar_edicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor uuid := coalesce(nullif(current_setting('app.autor_id', true), '')::uuid, auth.uid());
  v_just  text := nullif(current_setting('app.justificativa', true), '');
begin
  if new.nome is distinct from old.nome then
    insert into edicoes (santo_id, autor_id, campo, valor_anterior, valor_novo, justificativa)
    values (old.id, v_autor, 'nome', old.nome, new.nome, v_just);
  end if;
  if new.tipo is distinct from old.tipo then
    insert into edicoes (santo_id, autor_id, campo, valor_anterior, valor_novo, justificativa)
    values (old.id, v_autor, 'tipo', old.tipo, new.tipo, v_just);
  end if;
  if new.resumo is distinct from old.resumo then
    insert into edicoes (santo_id, autor_id, campo, valor_anterior, valor_novo, justificativa)
    values (old.id, v_autor, 'resumo', old.resumo, new.resumo, v_just);
  end if;
  -- text[] é gravado no literal do Postgres ({a,b,"c d"}), que volta com ::text[]
  if new.sinais is distinct from old.sinais then
    insert into edicoes (santo_id, autor_id, campo, valor_anterior, valor_novo, justificativa)
    values (old.id, v_autor, 'sinais', old.sinais::text, new.sinais::text, v_just);
  end if;
  if new.festa is distinct from old.festa then
    insert into edicoes (santo_id, autor_id, campo, valor_anterior, valor_novo, justificativa)
    values (old.id, v_autor, 'festa', old.festa, new.festa, v_just);
  end if;
  if new.padroeiro is distinct from old.padroeiro then
    insert into edicoes (santo_id, autor_id, campo, valor_anterior, valor_novo, justificativa)
    values (old.id, v_autor, 'padroeiro', old.padroeiro, new.padroeiro, v_just);
  end if;
  if new.confusao is distinct from old.confusao then
    insert into edicoes (santo_id, autor_id, campo, valor_anterior, valor_novo, justificativa)
    values (old.id, v_autor, 'confusao', old.confusao, new.confusao, v_just);
  end if;
  if new.foto_capa is distinct from old.foto_capa then
    insert into edicoes (santo_id, autor_id, campo, valor_anterior, valor_novo, justificativa)
    values (old.id, v_autor, 'foto_capa', old.foto_capa, new.foto_capa, v_just);
  end if;
  return null;
end;
$$;

create or replace function public.santos_tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists santos_registrar_edicao_tg on public.santos;
create trigger santos_registrar_edicao_tg
  after update on public.santos
  for each row execute function public.santos_registrar_edicao();

drop trigger if exists santos_tocar_atualizado_em_tg on public.santos;
create trigger santos_tocar_atualizado_em_tg
  before update on public.santos
  for each row execute function public.santos_tocar_atualizado_em();

-- =====================================================================
-- RPC de edição: grava o autor e a justificativa junto com a alteração.
-- =====================================================================
create or replace function public.editar_santo(
  p_santo_id      uuid,
  p_campo         text,
  p_valor         text,
  p_justificativa text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado para editar um verbete.';
  end if;
  if p_campo not in ('nome','tipo','resumo','sinais','festa','padroeiro','confusao','foto_capa') then
    raise exception 'Campo não editável: %', p_campo;
  end if;

  perform set_config('app.autor_id', auth.uid()::text, true);
  perform set_config('app.justificativa', coalesce(p_justificativa, ''), true);

  if p_campo = 'sinais' then
    update santos set sinais = coalesce(p_valor, '{}')::text[] where id = p_santo_id;
  else
    execute format('update santos set %I = $1 where id = $2', p_campo)
      using nullif(p_valor, ''), p_santo_id;
  end if;

  if not found then
    raise exception 'Verbete não encontrado.';
  end if;
end;
$$;

-- Reverter para qualquer versão: grava uma NOVA edição, não apaga nada.
create or replace function public.reverter_edicao(p_edicao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edicao edicoes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado para reverter uma edição.';
  end if;

  select * into v_edicao from edicoes where id = p_edicao_id;
  if not found then
    raise exception 'Edição não encontrada.';
  end if;

  perform public.editar_santo(
    v_edicao.santo_id,
    v_edicao.campo,
    v_edicao.valor_anterior,
    format('Revertido para a versão de %s',
           to_char(v_edicao.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
  );
end;
$$;

revoke all on function public.editar_santo(uuid, text, text, text) from public, anon;
revoke all on function public.reverter_edicao(uuid) from public, anon;
grant execute on function public.editar_santo(uuid, text, text, text) to authenticated;
grant execute on function public.reverter_edicao(uuid) to authenticated;

-- =====================================================================
-- Ranking: santos com a contagem de scans. security_invoker mantém a
-- RLS de quem consulta.
-- =====================================================================
create or replace view public.santos_ranking
with (security_invoker = on) as
select
  s.*,
  coalesce(k.total, 0)::bigint as total_scans,
  coalesce(a.total, 0)::bigint as total_avistamentos
from public.santos s
left join (select santo_id, count(*) as total from public.scans group by santo_id) k on k.santo_id = s.id
left join (select santo_id, count(*) as total from public.avistamentos group by santo_id) a on a.santo_id = s.id;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.santos           enable row level security;
alter table public.categorias       enable row level security;
alter table public.santo_categoria  enable row level security;
alter table public.edicoes          enable row level security;
alter table public.avistamentos     enable row level security;
alter table public.scans            enable row level security;
alter table public.forum_topicos    enable row level security;
alter table public.forum_respostas  enable row level security;
alter table public.identificacao_ip enable row level security;

-- santos: o livro é público; escrever exige login.
drop policy if exists santos_leitura on public.santos;
create policy santos_leitura on public.santos
  for select using (true);

drop policy if exists santos_criacao on public.santos;
create policy santos_criacao on public.santos
  for insert to authenticated with check (true);

drop policy if exists santos_edicao on public.santos;
create policy santos_edicao on public.santos
  for update to authenticated using (true) with check (true);

-- categorias
drop policy if exists categorias_leitura on public.categorias;
create policy categorias_leitura on public.categorias
  for select using (true);

drop policy if exists categorias_criacao on public.categorias;
create policy categorias_criacao on public.categorias
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists santo_categoria_leitura on public.santo_categoria;
create policy santo_categoria_leitura on public.santo_categoria
  for select using (true);

drop policy if exists santo_categoria_criacao on public.santo_categoria;
create policy santo_categoria_criacao on public.santo_categoria
  for insert to authenticated with check (true);

drop policy if exists santo_categoria_remocao on public.santo_categoria;
create policy santo_categoria_remocao on public.santo_categoria
  for delete to authenticated using (true);

-- edicoes: histórico público e imutável. Só o gatilho escreve; não há
-- policy de insert, update nem delete para ninguém.
drop policy if exists edicoes_leitura on public.edicoes;
create policy edicoes_leitura on public.edicoes
  for select using (true);

-- avistamentos: feed público; publicar exige login e só em nome próprio.
drop policy if exists avistamentos_leitura on public.avistamentos;
create policy avistamentos_leitura on public.avistamentos
  for select using (true);

drop policy if exists avistamentos_criacao on public.avistamentos;
create policy avistamentos_criacao on public.avistamentos
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists avistamentos_remocao on public.avistamentos;
create policy avistamentos_remocao on public.avistamentos
  for delete to authenticated using (autor_id = auth.uid());

-- scans: identificar funciona sem login.
drop policy if exists scans_leitura on public.scans;
create policy scans_leitura on public.scans
  for select using (true);

drop policy if exists scans_criacao on public.scans;
create policy scans_criacao on public.scans
  for insert with check (autor_id is null or autor_id = auth.uid());

-- fórum: privado de verdade. Sem login, nem o SELECT passa.
drop policy if exists forum_topicos_leitura on public.forum_topicos;
create policy forum_topicos_leitura on public.forum_topicos
  for select to authenticated using (true);

drop policy if exists forum_topicos_criacao on public.forum_topicos;
create policy forum_topicos_criacao on public.forum_topicos
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists forum_respostas_leitura on public.forum_respostas;
create policy forum_respostas_leitura on public.forum_respostas
  for select to authenticated using (true);

drop policy if exists forum_respostas_criacao on public.forum_respostas;
create policy forum_respostas_criacao on public.forum_respostas
  for insert to authenticated with check (autor_id = auth.uid());

-- identificacao_ip: nenhuma policy. Só a service role enxerga.

-- =====================================================================
-- Storage: fotos dos avistamentos
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avistamentos', 'avistamentos', true)
on conflict (id) do nothing;

drop policy if exists avistamentos_storage_leitura on storage.objects;
create policy avistamentos_storage_leitura on storage.objects
  for select using (bucket_id = 'avistamentos');

drop policy if exists avistamentos_storage_envio on storage.objects;
create policy avistamentos_storage_envio on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avistamentos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avistamentos_storage_remocao on storage.objects;
create policy avistamentos_storage_remocao on storage.objects
  for delete to authenticated
  using (bucket_id = 'avistamentos' and (storage.foldername(name))[1] = auth.uid()::text);
