-- =====================================================================
-- SANTUÁRIO — acervo inicial
-- Rode depois de supabase/schema.sql. Pode rodar mais de uma vez:
-- tudo aqui é idempotente.
--
-- As quatro fotos foram tiradas pelo dono do projeto em uma mesma
-- igreja e ficam em public/seed/ (servidas em /seed/...).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Verbetes
-- ---------------------------------------------------------------------
insert into public.santos (slug, nome, tipo, resumo, sinais, festa, padroeiro, confusao, origem, foto_capa)
values
(
  'nossa-senhora-aparecida',
  'Nossa Senhora Aparecida',
  'nossa_senhora',
  'Advocação de Nossa Senhora da Conceição ligada à pequena imagem de terracota escura recolhida do rio Paraíba do Sul por três pescadores, em 1717. A devoção cresceu em torno do lugar onde a imagem foi encontrada, hoje Aparecida, no vale do Paraíba paulista. Foi proclamada padroeira do Brasil por Pio XI em 1930. Nas igrejas brasileiras costuma aparecer vestida com o manto bordado, sob a coroa imperial.',
  array['imagem pequena de terracota escura','manto azul bordado cobrindo o corpo todo','coroa imperial','auréola de estrelas','mãos juntas em oração'],
  '12 de outubro',
  'Padroeira do Brasil',
  'Confunde-se com Nossa Senhora da Conceição, de quem é uma representação: a Conceição aparece de pé sobre a lua e a serpente, com vestes brancas e manto azul soltos e as mãos abertas. Aparecida é escura, menor, quase sempre coberta pelo manto bordado que deixa ver só o rosto e as mãos.',
  'seed',
  '/seed/nossa-senhora-aparecida.jpg'
),
(
  'sao-miguel-arcanjo',
  'São Miguel Arcanjo',
  'anjo',
  'Arcanjo, não santo: é uma criatura angélica, chefe da milícia celeste. Aparece no Apocalipse vencendo o dragão e no livro de Daniel como o príncipe que defende o povo de Deus. Na iconografia brasileira e ibérica é quase sempre um jovem guerreiro alado que pisa o demônio vencido e, em muitas imagens, pesa as almas na balança.',
  array['asas','armadura ou túnica militar romana','espada ou lança erguida','balança de pesar almas','demônio ou dragão pisado sob os pés'],
  '29 de setembro',
  'Padroeiro dos soldados, dos policiais e da Igreja universal',
  'Confunde-se com São Jorge, que também vence um dragão. São Jorge é um soldado humano, a cavalo, sem asas, que fura o dragão com a lança. São Miguel tem asas, costuma estar a pé e pisa um demônio de forma humanizada. Também se confunde com São Rafael Arcanjo, que leva um peixe e um bordão de peregrino, e com São Gabriel, que leva o lírio do anúncio.',
  'seed',
  '/seed/sao-miguel-arcanjo.jpg'
),
(
  'santo-antonio-de-padua',
  'Santo Antônio de Pádua',
  'santo',
  'Nascido em Lisboa por volta de 1195 e morto em Pádua em 1231, foi frade franciscano, pregador e doutor da Igreja. No Brasil é um dos santos de devoção mais antiga e popular, festejado em junho junto com São João e São Pedro. Quase sempre é representado com o Menino Jesus sobre o livro, cena ligada a uma visão atribuída a ele no fim da vida.',
  array['hábito franciscano marrom','cordão branco com três nós','Menino Jesus no braço','lírio branco','livro aberto','tonsura'],
  '13 de junho',
  'Padroeiro dos casamentos, dos objetos perdidos, de Lisboa e de Pádua',
  'Confunde-se com São Francisco de Assis, que usa o mesmo hábito e o mesmo cordão de três nós. Francisco aparece com as chagas nas mãos, crucifixo, caveira ou animais, e nunca com o Menino Jesus no braço. Também se confunde com Santo Antônio de Categeró, representado negro e com o Menino, mas de feições e hábito diferentes.',
  'seed',
  '/seed/santo-antonio-de-padua.jpg'
),
(
  'sagrado-coracao-de-jesus',
  'Sagrado Coração de Jesus',
  'cristo',
  'Não é um santo: é uma representação do próprio Cristo, centrada no seu coração como sinal do amor de Deus pelos homens. A devoção se difundiu a partir das aparições a Santa Margarida Maria Alacoque, em Paray-le-Monial, entre 1673 e 1675. Foi uma das imagens mais presentes nas salas das casas brasileiras no século XX, ligada ao costume de consagrar a família.',
  array['coração visível no peito','coroa de espinhos em volta do coração','chamas e cruz sobre o coração','túnica branca e manto vermelho','mão direita apontando o coração ou abençoando'],
  'Sexta-feira depois da oitava de Corpus Christi (data móvel)',
  'Invocado na consagração das famílias e dos lares',
  'Confunde-se com o Imaculado Coração de Maria, que tem a mesma pose e o mesmo coração à mostra, mas é figura feminina e o coração é cercado de rosas e atravessado por uma espada, não por espinhos. Também se confunde com o Cristo Rei, que leva coroa e cetro, e com o Senhor Bom Jesus, sem o coração exposto.',
  'seed',
  '/seed/sagrado-coracao-de-jesus.jpg'
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
insert into public.categorias (slug, nome, descricao)
values
  ('advocacoes-marianas',      'Advocações marianas',      'Os muitos títulos sob os quais Nossa Senhora é venerada. Não são santas diferentes: são invocações da mesma pessoa.'),
  ('arcanjos',                 'Arcanjos',                 'Criaturas angélicas nomeadas pela Escritura. Não são santos, e a Igreja só dá nome litúrgico a três: Miguel, Gabriel e Rafael.'),
  ('representacoes-de-cristo', 'Representações de Cristo', 'Imagens do próprio Senhor. Também não são santos, por mais que apareçam ao lado deles nos altares.'),
  ('santos-franciscanos',      'Santos franciscanos',      'Santos da família de São Francisco, reconhecíveis pelo hábito marrom e pelo cordão de três nós.'),
  ('padroeiros-do-brasil',     'Padroeiros do Brasil',     'Quem a Igreja no Brasil invoca como protetor do país e do seu povo.')
on conflict (slug) do nothing;

insert into public.santo_categoria (santo_id, categoria_id)
select s.id, c.id
from (values
  ('nossa-senhora-aparecida',  'advocacoes-marianas'),
  ('nossa-senhora-aparecida',  'padroeiros-do-brasil'),
  ('sao-miguel-arcanjo',       'arcanjos'),
  ('santo-antonio-de-padua',   'santos-franciscanos'),
  ('sagrado-coracao-de-jesus', 'representacoes-de-cristo')
) as v(santo_slug, categoria_slug)
join public.santos s      on s.slug = v.santo_slug
join public.categorias c  on c.slug = v.categoria_slug
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Avistamentos iniciais
--
-- avistamentos.autor_id aponta para auth.users, então o dono do projeto
-- precisa ter entrado no site pelo menos uma vez (link mágico em /entrar)
-- antes desta parte rodar. Troque o e-mail abaixo se for outro.
-- Se o usuário ainda não existir, o bloco avisa e não insere nada — é só
-- rodar este arquivo de novo depois do primeiro login.
-- ---------------------------------------------------------------------
do $$
declare
  v_email text := 'jokanaka08@gmail.com';
  v_autor uuid;
  v_igreja text := 'Igreja Matriz — São Paulo, SP';
begin
  select id into v_autor from auth.users where lower(email) = lower(v_email) limit 1;

  if v_autor is null then
    raise notice 'Usuário % ainda não existe. Entre uma vez em /entrar e rode este arquivo de novo para criar os avistamentos iniciais.', v_email;
    return;
  end if;

  insert into public.avistamentos (santo_id, autor_id, foto_url, local_nome)
  select s.id, v_autor, s.foto_capa, v_igreja
  from public.santos s
  where s.origem = 'seed'
    and s.foto_capa is not null
    and not exists (
      select 1 from public.avistamentos a
      where a.santo_id = s.id and a.autor_id = v_autor and a.local_nome = v_igreja
    );

  -- Um scan por verbete do acervo, para o ranking não começar zerado.
  insert into public.scans (santo_id, autor_id, certeza)
  select s.id, v_autor, 'alta'
  from public.santos s
  where s.origem = 'seed'
    and not exists (select 1 from public.scans k where k.santo_id = s.id);
end;
$$;
