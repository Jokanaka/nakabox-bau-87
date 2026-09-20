-- =====================================================================
-- Arremedo mínimo do ambiente Supabase, para rodar o schema num Postgres
-- qualquer e testar as regras. NÃO rode isto no Supabase de verdade —
-- lá estas coisas já existem.
-- =====================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- No Supabase, auth.uid() lê o JWT. Aqui lê uma variável de sessão, para
-- que os testes possam "entrar" como um usuário ou como anônimo.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table storage.buckets (
  id text primary key, name text, public boolean default false
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text,
  name      text,
  owner     uuid
);

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;

alter table storage.objects enable row level security;
