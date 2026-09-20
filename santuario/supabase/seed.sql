-- =====================================================================
-- SANTUÁRIO — acervo inicial
-- Quatro imagens fotografadas pelo dono do projeto, na mesma igreja.
-- Rode depois de supabase/schema.sql. As fotos ficam em public/seed/.
--
-- Pode rodar mais de uma vez: tudo aqui é idempotente.
-- =====================================================================

insert into public.categorias (nome, slug) values
  ('Nossa Senhora',                'nossa-senhora'),
  ('Cristo',                       'cristo'),
  ('Arcanjos',                     'arcanjos'),
  ('Sagrada Família',              'sagrada-familia'),
  ('Padroeiros dos trabalhadores', 'padroeiros-dos-trabalhadores')
on conflict (slug) do nothing;

insert into public.santos (slug, nome, tipo, resumo, sinais, festa, padroeiro, confusao, origem, foto_capa) values
(
  'nossa-senhora-da-paz',
  'Nossa Senhora da Paz',
  'nossa_senhora',
  'Título de Maria como Rainha da Paz, invocada pela reconciliação entre os povos e nas famílias. A oliveira, símbolo da paz desde a pomba de Noé, é o sinal mais ligado a essa advocação.',
  array[
    'Coroa de metal dourado sobre o véu',
    'Menino Jesus no braço esquerdo, segurando o globo',
    'Manto rosado sobre túnica clara',
    'Ramo de oliveira, aqui na mão do anjo do mural ao lado'
  ],
  'Varia conforme a paróquia (24 de janeiro é a data mais comum)',
  'Da paz entre os povos e nas famílias',
  'Pode ser confundida com Nossa Senhora Auxiliadora, que também aparece coroada com o Menino segurando o globo. Na da Paz, procure o ramo de oliveira ou a pomba.',
  'seed',
  '/seed/nossa-senhora-da-paz.jpg'
),
(
  'sao-jose',
  'São José',
  'santo',
  'Esposo da Virgem Maria e pai adotivo de Jesus, carpinteiro de Nazaré. Padroeiro da Igreja universal.',
  array[
    'Vara de lírios brancos na mão direita',
    'Menino Jesus no braço esquerdo',
    'Barba escura e cabelo cheio',
    'Túnica azul com manto marrom e ocre'
  ],
  '19 de março (e 1º de maio, São José Operário)',
  'Da Igreja universal, dos trabalhadores, dos pais de família e da boa morte',
  'Santo Antônio também carrega o Menino, mas usa hábito franciscano marrom com cordão e tem tonsura. São José usa túnica e manto de leigo e tem barba cheia.',
  'seed',
  '/seed/sao-jose.jpg'
),
(
  'sao-miguel-arcanjo',
  'São Miguel Arcanjo',
  'anjo',
  'Príncipe da milícia celeste, que combate o dragão no Apocalipse 12. Seu nome em hebraico é uma pergunta: quem como Deus?',
  array[
    'Asas de anjo com armadura de guerreiro',
    'Lança cravada no demônio caído',
    'Pé sobre a figura derrotada',
    'Couraça de escamas, túnica curta e manto vermelho'
  ],
  '29 de setembro, com Gabriel e Rafael',
  'Dos policiais, dos militares e dos moribundos',
  'São Jorge também vence um dragão com lança, mas não tem asas e aparece a cavalo.',
  'seed',
  '/seed/sao-miguel-arcanjo.jpg'
),
(
  'sagrado-coracao-de-jesus',
  'Sagrado Coração de Jesus',
  'cristo',
  'Devoção ao amor de Cristo pela humanidade, difundida a partir das aparições a Santa Margarida Maria Alacoque em Paray-le-Monial, França, no século 17.',
  array[
    'Coração exposto no peito, em chamas e coroado de espinhos',
    'Mão direita apontando para o coração',
    'Mão esquerda aberta mostrando a chaga do prego',
    'Túnica branca com manto vermelho',
    'Auréola dourada'
  ],
  'Móvel: sexta-feira depois da oitava de Corpus Christi, em junho',
  'Das famílias consagradas a ele e de muitas nações',
  'O Imaculado Coração de Maria também mostra o coração no peito, mas é uma figura feminina e o coração aparece cercado de rosas ou transpassado por uma espada.',
  'seed',
  '/seed/sagrado-coracao-de-jesus.jpg'
)
on conflict (slug) do nothing;

insert into public.santo_categoria (santo_id, categoria_id)
select s.id, c.id from public.santos s join public.categorias c on
  (s.slug = 'nossa-senhora-da-paz'     and c.slug = 'nossa-senhora') or
  (s.slug = 'sao-jose'                 and c.slug in ('sagrada-familia', 'padroeiros-dos-trabalhadores')) or
  (s.slug = 'sao-miguel-arcanjo'       and c.slug = 'arcanjos') or
  (s.slug = 'sagrado-coracao-de-jesus' and c.slug = 'cristo')
on conflict do nothing;

-- Avistamentos iniciais sem autor: são da casa, não de um usuário.
-- TROQUE O LOCAL pelo nome real da igreja antes de rodar.
insert into public.avistamentos (santo_id, autor_id, foto_url, local_nome)
select s.id, null, s.foto_capa, 'Paróquia (definir nome), São Paulo'
from public.santos s
where s.origem = 'seed'
  and s.foto_capa is not null
  -- guarda de idempotência: não duplica se este arquivo rodar de novo
  and not exists (
    select 1 from public.avistamentos a
    where a.santo_id = s.id and a.autor_id is null
  );
