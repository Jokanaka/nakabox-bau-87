-- =====================================================================
-- As regras que não podem quebrar, verificadas contra um Postgres real.
--
-- Como rodar (precisa de um Postgres vazio, NÃO o de produção).
-- O -v ON_ERROR_STOP=1 é obrigatório: sem ele o psql segue depois de um
-- erro e a trava de banco-sujo lá embaixo vira falso negativo.
--
--   psql -v ON_ERROR_STOP=1 -f supabase/testes/harness.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/schema.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/seed.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/testes/testes.sql
--
-- Cada linha imprime PASSOU ou FALHOU. Esperado: 16 PASSOU, 0 FALHOU.
-- =====================================================================

-- O Supabase concede isto por padrão nas tabelas de public; o teste
-- precisa imitar, inclusive os revokes que o schema.sql aplica depois.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
revoke insert, update, delete on public.edicoes from anon, authenticated;
revoke insert, update, delete on public.scans  from anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'joaquim@exemplo.com')
on conflict do nothing;

-- Trava: a suíte conta linhas, então só vale num banco recém-semeado.
-- Rodar duas vezes seguidas daria falso negativo.
do $$
begin
  if (select count(*) from edicoes) <> 0 or (select count(*) from scans) <> 0
     or (select count(*) from forum_topicos) <> 0 then
    raise exception 'Banco já usado. Recrie: harness.sql, schema.sql, seed.sql e só então testes.sql.';
  end if;
end $$;

create or replace function testar(rotulo text, condicao boolean) returns void
language plpgsql as $$
begin
  raise notice '%  %', case when condicao then 'PASSOU' else '>>> FALHOU' end, rotulo;
end $$;

\echo ''
\echo '============ REGRAS QUE NAO PODEM QUEBRAR ============'

-- ---------------------------------------------------------------- fórum
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into forum_topicos (autor_id, titulo, corpo)
values ('11111111-1111-1111-1111-111111111111', 'Dúvida do lírio', 'São José ou Santo Antônio?');
select testar('fórum: logado lê os tópicos', (select count(*) from forum_topicos) = 1);

reset role; set role anon; set request.jwt.claim.sub = '';
select testar('fórum: anônimo NÃO lê tópicos',   (select count(*) from forum_topicos)   = 0);
select testar('fórum: anônimo NÃO lê respostas', (select count(*) from forum_respostas) = 0);

-- ---------------------------------------------------------- avistamento
do $$ declare n int; begin
  insert into avistamentos (santo_id, autor_id, foto_url, local_nome)
  values ((select id from santos limit 1), null, '/x.jpg', 'Anônimo');
  get diagnostics n = row_count;
  perform testar('avistamento: anônimo não publica', n = 0);
exception when others then
  perform testar('avistamento: anônimo não publica', true);
end $$;

-- ------------------------------------------------------------ histórico
reset role; set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select editar_santo((select id from santos where slug='sao-jose'), 'festa', '19 de março', 'Encurtei');
select testar('edição via RPC grava em edicoes', (select count(*) from edicoes) = 1);

-- O gatilho precisa pegar até quem não passa pela RPC.
update santos set padroeiro = 'Dos carpinteiros' where slug = 'sao-jose';
select testar('update DIRETO também grava (gatilho)', (select count(*) from edicoes) = 2);

select testar('edicoes guarda o autor',
  (select autor_id from edicoes order by criado_em limit 1) = '11111111-1111-1111-1111-111111111111');

do $$ begin
  delete from edicoes;
  perform testar('histórico não pode ser apagado', false);
exception when insufficient_privilege then
  perform testar('histórico não pode ser apagado', true);
end $$;

do $$ begin
  update edicoes set valor_novo = 'adulterado';
  perform testar('histórico não pode ser adulterado', false);
exception when insufficient_privilege then
  perform testar('histórico não pode ser adulterado', true);
end $$;

do $$ begin
  insert into edicoes (santo_id, campo, valor_novo)
  values ((select id from santos limit 1), 'nome', 'forjado');
  perform testar('histórico não aceita entrada forjada', false);
exception when insufficient_privilege then
  perform testar('histórico não aceita entrada forjada', true);
end $$;

-- -------------------------------------------------------------- ranking
do $$ begin
  insert into scans (santo_id, autor_id, certeza)
  values ((select id from santos limit 1), null, 'alta');
  perform testar('ranking: navegador não insere scan', false);
exception when insufficient_privilege then
  perform testar('ranking: navegador não insere scan', true);
end $$;

-- ------------------------------------------------------------- reverter
select testar('antes de reverter, festa está encurtada',
  (select festa from santos where slug='sao-jose') = '19 de março');

select reverter_edicao((select id from edicoes where campo='festa' order by criado_em limit 1));

select testar('reverter devolve o valor antigo',
  (select festa from santos where slug='sao-jose') = '19 de março (e 1º de maio, São José Operário)');
select testar('reverter GRAVA nova entrada, não apaga', (select count(*) from edicoes) = 3);

-- --------------------------------- o servidor (service role) ainda pode
reset role;
insert into scans (santo_id, autor_id, certeza)
select id, null, 'alta' from santos where slug='sao-miguel-arcanjo';
select testar('servidor ainda grava scan', (select count(*) from scans) = 1);
select testar('ranking reflete o scan',
  (select total_scans from santos_ranking where slug='sao-miguel-arcanjo') = 1);
