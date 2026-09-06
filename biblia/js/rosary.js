// Santo Rosário: mistérios, passagens bíblicas e sequência guiada
export const MYSTERIES = {
  gozosos: { name: 'Mistérios Gozosos', days: 'segunda e sábado', color: '#2F5D8A', list: [
    { t: 'A Anunciação do Anjo a Maria', ref: ['lc', 1, 26, 38], fruit: 'humildade' },
    { t: 'A Visitação de Maria a Isabel', ref: ['lc', 1, 39, 56], fruit: 'caridade' },
    { t: 'O Nascimento de Jesus em Belém', ref: ['lc', 2, 1, 20], fruit: 'pobreza de espírito' },
    { t: 'A Apresentação de Jesus no Templo', ref: ['lc', 2, 22, 38], fruit: 'obediência' },
    { t: 'O Encontro de Jesus no Templo', ref: ['lc', 2, 41, 52], fruit: 'busca de Deus' },
  ] },
  dolorosos: { name: 'Mistérios Dolorosos', days: 'terça e sexta', color: '#7B1E3B', list: [
    { t: 'A Agonia de Jesus no Horto', ref: ['lc', 22, 39, 46], fruit: 'contrição' },
    { t: 'A Flagelação de Jesus', ref: ['jo', 19, 1, 1], fruit: 'pureza' },
    { t: 'A Coroação de Espinhos', ref: ['mt', 27, 27, 31], fruit: 'coragem' },
    { t: 'Jesus carrega a Cruz', ref: ['lc', 23, 26, 32], fruit: 'paciência' },
    { t: 'A Crucifixão e Morte de Jesus', ref: ['jo', 19, 25, 30], fruit: 'perseverança' },
  ] },
  gloriosos: { name: 'Mistérios Gloriosos', days: 'quarta e domingo', color: '#B08A1F', list: [
    { t: 'A Ressurreição de Jesus', ref: ['mt', 28, 1, 10], fruit: 'fé' },
    { t: 'A Ascensão de Jesus ao Céu', ref: ['at', 1, 6, 11], fruit: 'esperança' },
    { t: 'A Vinda do Espírito Santo', ref: ['at', 2, 1, 13], fruit: 'amor' },
    { t: 'A Assunção de Maria ao Céu', ref: ['ap', 12, 1, 6], fruit: 'graça de uma boa morte' },
    { t: 'A Coroação de Maria como Rainha', ref: ['ap', 12, 1, 1], fruit: 'confiança em Maria' },
  ] },
  luminosos: { name: 'Mistérios Luminosos', days: 'quinta', color: '#2E5E4E', list: [
    { t: 'O Batismo de Jesus no Jordão', ref: ['mt', 3, 13, 17], fruit: 'abertura ao Espírito Santo' },
    { t: 'As Bodas de Caná', ref: ['jo', 2, 1, 11], fruit: 'confiança em Maria' },
    { t: 'O Anúncio do Reino de Deus', ref: ['mc', 1, 14, 15], fruit: 'conversão' },
    { t: 'A Transfiguração de Jesus', ref: ['lc', 9, 28, 36], fruit: 'desejo de santidade' },
    { t: 'A Instituição da Eucaristia', ref: ['lc', 22, 14, 20], fruit: 'adoração' },
  ] },
};

// mistério do dia (uso comum: Advento/Natal aos domingos → gozosos; Quaresma aos domingos → dolorosos)
export function mysteryOfDay(d = new Date(), season = null) {
  const dow = d.getDay();
  if (dow === 0) {
    if (season === 'advento' || season === 'natal') return 'gozosos';
    if (season === 'quaresma') return 'dolorosos';
    return 'gloriosos';
  }
  return ['gloriosos', 'gozosos', 'dolorosos', 'gloriosos', 'luminosos', 'dolorosos', 'gozosos'][dow];
}

const PN = 'Pai nosso, que estais nos céus, santificado seja o vosso nome; venha a nós o vosso reino; seja feita a vossa vontade, assim na terra como no céu. O pão nosso de cada dia nos dai hoje; perdoai-nos as nossas ofensas, assim como nós perdoamos a quem nos tem ofendido; e não nos deixeis cair em tentação, mas livrai-nos do mal. Amém.';
const AM = 'Ave Maria, cheia de graça, o Senhor é convosco; bendita sois vós entre as mulheres, e bendito é o fruto do vosso ventre, Jesus. Santa Maria, Mãe de Deus, rogai por nós, pecadores, agora e na hora da nossa morte. Amém.';
const GL = 'Glória ao Pai, e ao Filho, e ao Espírito Santo. Como era no princípio, agora e sempre. Amém.';
const FAT = 'Ó meu Jesus, perdoai-nos, livrai-nos do fogo do inferno, levai as almas todas para o céu, e socorrei principalmente as que mais precisarem.';
const CREDO = 'Creio em Deus Pai todo-poderoso, criador do céu e da terra; e em Jesus Cristo, seu único Filho, nosso Senhor; que foi concebido pelo poder do Espírito Santo; nasceu da Virgem Maria; padeceu sob Pôncio Pilatos, foi crucificado, morto e sepultado; desceu à mansão dos mortos; ressuscitou ao terceiro dia; subiu aos céus; está sentado à direita de Deus Pai todo-poderoso, donde há de vir a julgar os vivos e os mortos. Creio no Espírito Santo; na santa Igreja católica; na comunhão dos santos; na remissão dos pecados; na ressurreição da carne; na vida eterna. Amém.';
const SALVE = 'Salve, Rainha, Mãe de misericórdia, vida, doçura e esperança nossa, salve! A vós bradamos, os degredados filhos de Eva; a vós suspiramos, gemendo e chorando neste vale de lágrimas. Eia, pois, advogada nossa, esses vossos olhos misericordiosos a nós volvei; e depois deste desterro nos mostrai Jesus, bendito fruto do vosso ventre, ó clemente, ó piedosa, ó doce sempre Virgem Maria.\nV. Rogai por nós, santa Mãe de Deus.\nR. Para que sejamos dignos das promessas de Cristo. Amém.';
const FINAL = 'Ó Deus, cujo Filho Unigênito, por sua vida, morte e ressurreição, nos alcançou o prêmio da salvação eterna, concedei-nos, vos pedimos, que, meditando estes mistérios do santíssimo Rosário da Virgem Maria, imitemos o que eles contêm e alcancemos o que prometem. Por Cristo, nosso Senhor. Amém.';

// gera a sequência de passos do Rosário para um conjunto de mistérios
export function rosarySteps(kind) {
  const m = MYSTERIES[kind];
  const steps = [];
  steps.push({ kind: 'Início', title: 'Sinal da Cruz', text: 'Em nome do Pai, e do Filho, e do Espírito Santo. Amém.' });
  steps.push({ kind: 'Início', title: 'Oferecimento', text: 'Divino Jesus, nós vos oferecemos este terço que vamos rezar, meditando nos mistérios da vossa redenção. Concedei-nos, pela intercessão de Maria, vossa Mãe santíssima, a quem nos dirigimos, as virtudes que nos são necessárias para bem rezá-lo e a graça de ganharmos as indulgências desta santa devoção.' });
  steps.push({ kind: 'Início', title: 'Creio', text: CREDO });
  steps.push({ kind: 'Início', title: 'Pai Nosso', text: PN, bead: 'pn' });
  for (let i = 1; i <= 3; i++) steps.push({ kind: 'Início', title: `Ave Maria (${i} de 3)`, text: AM, sub: ['pela fé', 'pela esperança', 'pela caridade'][i - 1], bead: 'am' });
  steps.push({ kind: 'Início', title: 'Glória ao Pai', text: GL });
  m.list.forEach((my, i) => {
    steps.push({ kind: `${i + 1}º mistério ${kind.replace(/s$/, '')}`, title: my.t, text: `Fruto do mistério: ${my.fruit}.`, ref: my.ref, announce: true, mystery: i + 1 });
    steps.push({ kind: `${i + 1}º mistério`, title: 'Pai Nosso', text: PN, bead: 'pn', mystery: i + 1 });
    for (let j = 1; j <= 10; j++) steps.push({ kind: `${i + 1}º mistério`, title: `Ave Maria (${j} de 10)`, text: AM, bead: 'am', mystery: i + 1, n: j });
    steps.push({ kind: `${i + 1}º mistério`, title: 'Glória ao Pai', text: GL, mystery: i + 1 });
    steps.push({ kind: `${i + 1}º mistério`, title: 'Oração de Fátima', text: FAT, mystery: i + 1 });
  });
  steps.push({ kind: 'Conclusão', title: 'Salve Rainha', text: SALVE });
  steps.push({ kind: 'Conclusão', title: 'Oração final', text: FINAL });
  steps.push({ kind: 'Conclusão', title: 'Sinal da Cruz', text: 'Em nome do Pai, e do Filho, e do Espírito Santo. Amém.', last: true });
  return steps;
}
