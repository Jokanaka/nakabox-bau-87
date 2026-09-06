// Calendário litúrgico romano (calendário geral + Brasil) e leituras da Missa
import { todayISO, parseISO, addDays } from './util.js';

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DOWN = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const ORD = ['', '1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª', '11ª', '12ª', '13ª', '14ª', '15ª', '16ª', '17ª', '18ª', '19ª', '20ª', '21ª', '22ª', '23ª', '24ª', '25ª', '26ª', '27ª', '28ª', '29ª', '30ª', '31ª', '32ª', '33ª', '34ª'];
const ORDM = ['', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º', '11º', '12º', '13º', '14º', '15º', '16º', '17º', '18º', '19º', '20º', '21º', '22º', '23º', '24º', '25º', '26º', '27º', '28º', '29º', '30º', '31º', '32º', '33º', '34º'];

export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const D = (y, m, d) => new Date(y, m - 1, d);
const days = (a, b) => Math.round((D(b.getFullYear(), b.getMonth() + 1, b.getDate()) - D(a.getFullYear(), a.getMonth() + 1, a.getDate())) / 86400000);
const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function sundayOnOrAfter(d) { return addDays(d, (7 - d.getDay()) % 7); }
function sundayOnOrBefore(d) { return addDays(d, -d.getDay()); }
export function advent1(y) { // domingo entre 27/11 e 3/12
  const xmas = D(y, 12, 25);
  return addDays(sundayOnOrBefore(xmas), -21 - (xmas.getDay() === 0 ? 7 : 0) + (xmas.getDay() === 0 ? 7 : 0) - 0 - (xmas.getDay() === 0 ? 0 : 0) - 7 + 7 - 7 * 0) ;
}
// implementação direta: 4º domingo antes do Natal
export function adventStart(y) {
  const xmas = D(y, 12, 25);
  const dow = xmas.getDay(); // 0=dom
  const fourth = addDays(xmas, -(dow === 0 ? 7 : dow)); // domingo anterior ao Natal (4º domingo do Advento)
  return addDays(fourth, -21);
}

// Sanctoral: solenidades, festas e memórias mais conhecidas (calendário geral + Brasil)
// rank: S=solenidade, F=festa, M=memória, m=memória facultativa ; color: b=branco, r=vermelho, v=verde, x=roxo, s=rosa
export const SANCTORAL = {
  '01-01': { n: 'Santa Maria, Mãe de Deus', r: 'S', c: 'b', key: 'maria-mae-de-deus' },
  '01-02': { n: 'São Basílio Magno e São Gregório Nazianzeno', r: 'M', c: 'b' },
  '01-17': { n: 'Santo Antão, abade', r: 'M', c: 'b' },
  '01-21': { n: 'Santa Inês, virgem e mártir', r: 'M', c: 'r' },
  '01-24': { n: 'São Francisco de Sales', r: 'M', c: 'b' },
  '01-25': { n: 'Conversão de São Paulo Apóstolo', r: 'F', c: 'b', key: 'f-01-25' },
  '01-26': { n: 'São Timóteo e São Tito', r: 'M', c: 'b' },
  '01-28': { n: 'São Tomás de Aquino', r: 'M', c: 'b' },
  '01-31': { n: 'São João Bosco', r: 'M', c: 'b' },
  '02-02': { n: 'Apresentação do Senhor', r: 'F', c: 'b', key: 'f-02-02' },
  '02-05': { n: 'Santa Águeda, virgem e mártir', r: 'M', c: 'r' },
  '02-06': { n: 'São Paulo Miki e companheiros, mártires', r: 'M', c: 'r' },
  '02-11': { n: 'Nossa Senhora de Lourdes', r: 'm', c: 'b' },
  '02-14': { n: 'São Cirilo e São Metódio', r: 'M', c: 'b' },
  '02-22': { n: 'Cátedra de São Pedro Apóstolo', r: 'F', c: 'b', key: 'f-02-22' },
  '03-07': { n: 'Santas Perpétua e Felicidade, mártires', r: 'M', c: 'r' },
  '03-19': { n: 'São José, Esposo da Virgem Maria', r: 'S', c: 'b', key: 'f-03-19' },
  '03-25': { n: 'Anunciação do Senhor', r: 'S', c: 'b', key: 'f-03-25' },
  '04-25': { n: 'São Marcos Evangelista', r: 'F', c: 'r', key: 'f-04-25' },
  '04-29': { n: 'Santa Catarina de Sena', r: 'M', c: 'b' },
  '05-01': { n: 'São José Operário', r: 'm', c: 'b' },
  '05-03': { n: 'São Filipe e São Tiago, Apóstolos', r: 'F', c: 'r', key: 'f-05-03' },
  '05-13': { n: 'Nossa Senhora de Fátima', r: 'm', c: 'b' },
  '05-14': { n: 'São Matias Apóstolo', r: 'F', c: 'r', key: 'f-05-14' },
  '05-26': { n: 'São Filipe Néri', r: 'M', c: 'b' },
  '05-31': { n: 'Visitação de Nossa Senhora', r: 'F', c: 'b', key: 'f-05-31' },
  '06-01': { n: 'São Justino, mártir', r: 'M', c: 'r' },
  '06-09': { n: 'São José de Anchieta', r: 'M', c: 'b', br: true },
  '06-11': { n: 'São Barnabé Apóstolo', r: 'M', c: 'r' },
  '06-13': { n: 'Santo Antônio de Pádua', r: 'M', c: 'b' },
  '06-21': { n: 'São Luís Gonzaga', r: 'M', c: 'b' },
  '06-24': { n: 'Natividade de São João Batista', r: 'S', c: 'b', key: 'f-06-24' },
  '06-29': { n: 'São Pedro e São Paulo, Apóstolos', r: 'S', c: 'r', key: 'f-06-29' },
  '07-03': { n: 'São Tomé Apóstolo', r: 'F', c: 'r', key: 'f-07-03' },
  '07-09': { n: 'Santa Paulina do Coração Agonizante de Jesus', r: 'M', c: 'b', br: true },
  '07-11': { n: 'São Bento, abade', r: 'M', c: 'b' },
  '07-16': { n: 'Nossa Senhora do Carmo', r: 'm', c: 'b' },
  '07-22': { n: 'Santa Maria Madalena', r: 'F', c: 'b', key: 'f-07-22' },
  '07-25': { n: 'São Tiago Apóstolo', r: 'F', c: 'r', key: 'f-07-25' },
  '07-26': { n: 'São Joaquim e Sant\'Ana, pais de Nossa Senhora', r: 'M', c: 'b' },
  '07-29': { n: 'Santas Marta, Maria e Lázaro', r: 'M', c: 'b' },
  '07-31': { n: 'Santo Inácio de Loyola', r: 'M', c: 'b' },
  '08-01': { n: 'Santo Afonso Maria de Ligório', r: 'M', c: 'b' },
  '08-04': { n: 'São João Maria Vianney', r: 'M', c: 'b' },
  '08-06': { n: 'Transfiguração do Senhor', r: 'F', c: 'b', key: 'f-08-06' },
  '08-08': { n: 'São Domingos de Gusmão', r: 'M', c: 'b' },
  '08-10': { n: 'São Lourenço, diácono e mártir', r: 'F', c: 'r', key: 'f-08-10' },
  '08-11': { n: 'Santa Clara de Assis', r: 'M', c: 'b' },
  '08-13': { n: 'Santa Dulce dos Pobres', r: 'M', c: 'b', br: true },
  '08-14': { n: 'São Maximiliano Maria Kolbe, mártir', r: 'M', c: 'r' },
  '08-15': { n: 'Assunção de Nossa Senhora', r: 'S', c: 'b', key: 'f-08-15' },
  '08-20': { n: 'São Bernardo, abade e doutor', r: 'M', c: 'b' },
  '08-22': { n: 'Nossa Senhora Rainha', r: 'M', c: 'b' },
  '08-24': { n: 'São Bartolomeu Apóstolo', r: 'F', c: 'r', key: 'f-08-24' },
  '08-27': { n: 'Santa Mônica', r: 'M', c: 'b' },
  '08-28': { n: 'Santo Agostinho', r: 'M', c: 'b' },
  '08-29': { n: 'Martírio de São João Batista', r: 'M', c: 'r' },
  '09-03': { n: 'São Gregório Magno', r: 'M', c: 'b' },
  '09-08': { n: 'Natividade de Nossa Senhora', r: 'F', c: 'b', key: 'f-09-08' },
  '09-14': { n: 'Exaltação da Santa Cruz', r: 'F', c: 'r', key: 'f-09-14' },
  '09-15': { n: 'Nossa Senhora das Dores', r: 'M', c: 'b' },
  '09-21': { n: 'São Mateus, Apóstolo e Evangelista', r: 'F', c: 'r', key: 'f-09-21' },
  '09-23': { n: 'São Pio de Pietrelcina', r: 'M', c: 'b' },
  '09-27': { n: 'São Vicente de Paulo', r: 'M', c: 'b' },
  '09-29': { n: 'São Miguel, São Gabriel e São Rafael, Arcanjos', r: 'F', c: 'b', key: 'f-09-29' },
  '09-30': { n: 'São Jerônimo', r: 'M', c: 'b' },
  '10-01': { n: 'Santa Teresinha do Menino Jesus', r: 'M', c: 'b' },
  '10-02': { n: 'Santos Anjos da Guarda', r: 'M', c: 'b' },
  '10-04': { n: 'São Francisco de Assis', r: 'M', c: 'b' },
  '10-07': { n: 'Nossa Senhora do Rosário', r: 'M', c: 'b' },
  '10-12': { n: 'Nossa Senhora da Conceição Aparecida, Padroeira do Brasil', r: 'S', c: 'b', key: 'f-10-12', br: true },
  '10-15': { n: 'Santa Teresa de Jesus (de Ávila)', r: 'M', c: 'b' },
  '10-18': { n: 'São Lucas Evangelista', r: 'F', c: 'r', key: 'f-10-18' },
  '10-25': { n: 'Santo Antônio de Sant\'Ana Galvão', r: 'M', c: 'b', br: true },
  '10-28': { n: 'São Simão e São Judas, Apóstolos', r: 'F', c: 'r', key: 'f-10-28' },
  '11-01': { n: 'Todos os Santos', r: 'S', c: 'b', key: 'f-11-01' },
  '11-02': { n: 'Comemoração de Todos os Fiéis Defuntos', r: 'S', c: 'x', key: 'f-11-02' },
  '11-04': { n: 'São Carlos Borromeu', r: 'M', c: 'b' },
  '11-09': { n: 'Dedicação da Basílica de Latrão', r: 'F', c: 'b', key: 'f-11-09' },
  '11-11': { n: 'São Martinho de Tours', r: 'M', c: 'b' },
  '11-17': { n: 'Santa Isabel da Hungria', r: 'M', c: 'b' },
  '11-21': { n: 'Apresentação de Nossa Senhora', r: 'M', c: 'b' },
  '11-22': { n: 'Santa Cecília, virgem e mártir', r: 'M', c: 'r' },
  '11-30': { n: 'Santo André Apóstolo', r: 'F', c: 'r', key: 'f-11-30' },
  '12-03': { n: 'São Francisco Xavier', r: 'M', c: 'b' },
  '12-06': { n: 'São Nicolau', r: 'm', c: 'b' },
  '12-07': { n: 'Santo Ambrósio', r: 'M', c: 'b' },
  '12-08': { n: 'Imaculada Conceição de Nossa Senhora', r: 'S', c: 'b', key: 'f-12-08' },
  '12-12': { n: 'Nossa Senhora de Guadalupe', r: 'M', c: 'b' },
  '12-13': { n: 'Santa Luzia, virgem e mártir', r: 'M', c: 'r' },
  '12-14': { n: 'São João da Cruz', r: 'M', c: 'b' },
  '12-26': { n: 'Santo Estêvão, primeiro mártir', r: 'F', c: 'r', key: 'natal-12-26' },
  '12-27': { n: 'São João, Apóstolo e Evangelista', r: 'F', c: 'b', key: 'natal-12-27' },
  '12-28': { n: 'Santos Inocentes, mártires', r: 'F', c: 'r', key: 'natal-12-28' },
};
const COLORS = { b: 'Branco', r: 'Vermelho', v: 'Verde', x: 'Roxo', s: 'Rosa' };
const COLOR_HEX = { b: '#F5F1E6', r: '#B3261E', v: '#2E7D4F', x: '#6A3A9C', s: '#E39BB4' };

/** Calcula a informação litúrgica de uma data. */
export function liturgicalDay(date = new Date()) {
  const y = date.getFullYear();
  const dow = date.getDay();
  let adv = adventStart(y);
  let litYear = y; // ano civil em que começou o ano litúrgico
  if (date < adv) { adv = adventStart(y - 1); litYear = y - 1; }
  const cycle = ['C', 'A', 'B'][(litYear + 1) % 3];
  const wcycle = ((litYear + 1) % 2 === 1) ? 'I' : 'II';
  const xmas = D(litYear, 12, 25);
  const cy = litYear + 1; // ano civil da Páscoa deste ano litúrgico
  const pascoa = easter(cy);
  const cinzas = addDays(pascoa, -46);
  const ramos = addDays(pascoa, -7);
  const pentecostes = addDays(pascoa, 49);
  const ascensao = addDays(pascoa, 42); // no Brasil, 7º domingo da Páscoa
  const trindade = addDays(pascoa, 56);
  const corpus = addDays(pascoa, 60); // quinta-feira
  const sagradoCoracao = addDays(pascoa, 68);
  const imaculadoCoracao = addDays(pascoa, 69);
  const epifania = sundayOnOrAfter(D(cy, 1, 2)); // domingo entre 2 e 8 de janeiro
  let batismo = addDays(epifania, 7);
  if (epifania.getDate() >= 7) batismo = addDays(epifania, 1); // se Epifania cai em 7 ou 8/1, Batismo na segunda
  const proxAdv = adventStart(cy);
  const cristoRei = addDays(proxAdv, -7);
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const sanct = SANCTORAL[mmdd];

  const out = { date, dow, dowName: DOWN[dow], cycle, wcycle, season: '', seasonName: '', week: 0, color: 'v', name: '', key: '', rank: '', sanct: sanct || null, keys: [] };

  const set = (season, seasonName, week, color, name, key, rank = '') => Object.assign(out, { season, seasonName, week, color, name, key, rank });

  if (date >= adv && date < xmas) {
    const week = Math.floor(days(adv, date) / 7) + 1;
    const dec17 = D(litYear, 12, 17);
    const gaudete = week === 3 && dow === 0;
    set('advento', 'Tempo do Advento', week, gaudete ? 's' : 'x',
      dow === 0 ? `${ORDM[week]} Domingo do Advento${gaudete ? ' (Gaudete)' : ''}` : `${DOWN[dow]} da ${ORD[week]} semana do Advento`,
      dow === 0 ? `adv-${week}-dom-${cycle}` : (date >= dec17 ? `adv-${mmdd}` : `adv-${week}-${DOW[dow]}`));
  } else if (date >= xmas && date < batismo) {
    // Tempo do Natal
    const sagradaFamilia = xmas.getDay() === 0 ? D(litYear, 12, 30) : addDays(sundayOnOrAfter(addDays(xmas, 1)), 0);
    if (same(date, xmas)) set('natal', 'Tempo do Natal', 1, 'b', 'Natal do Senhor', 'natal-12-25', 'S');
    else if (same(date, sagradaFamilia)) set('natal', 'Tempo do Natal', 1, 'b', 'Sagrada Família de Jesus, Maria e José', `sagrada-familia-${cycle}`, 'F');
    else if (same(date, D(cy, 1, 1))) set('natal', 'Tempo do Natal', 1, 'b', 'Santa Maria, Mãe de Deus', 'maria-mae-de-deus', 'S');
    else if (same(date, epifania)) set('natal', 'Tempo do Natal', 2, 'b', 'Epifania do Senhor', 'epifania', 'S');
    else if (date > epifania) set('natal', 'Tempo do Natal', 2, 'b', `${DOWN[dow]} após a Epifania`, `epif-${DOW[dow]}`);
    else if (date > D(cy, 1, 1)) set('natal', 'Tempo do Natal', 2, 'b', dow === 0 ? '2º Domingo do Natal' : `${DOWN[dow]} do Tempo do Natal`, dow === 0 ? 'natal-dom2' : `natal-${mmdd}`);
    else set('natal', 'Tempo do Natal', 1, 'b', `${DOWN[dow]} da Oitava do Natal`, `natal-${mmdd}`);
  } else if (same(date, batismo)) {
    set('natal', 'Tempo do Natal', 1, 'b', 'Batismo do Senhor', `batismo-${cycle}`, 'F');
  } else if (date < cinzas) {
    // Tempo Comum I
    const sun1 = batismo.getDay() === 0 ? batismo : addDays(batismo, -1);
    const week = Math.floor(days(sun1, date) / 7) + 1;
    set('comum', 'Tempo Comum', week, 'v', dow === 0 ? `${ORDM[week]} Domingo do Tempo Comum` : `${DOWN[dow]} da ${ORD[week]} semana do Tempo Comum`,
      dow === 0 ? `to-${week}-dom-${cycle}` : `to-${week}-${DOW[dow]}-${wcycle}`);
  } else if (date < ramos) {
    const week = Math.floor(days(addDays(cinzas, 4), date) / 7) + 1; // domingo 1 = cinzas + 4
    if (same(date, cinzas)) set('quaresma', 'Tempo da Quaresma', 0, 'x', 'Quarta-feira de Cinzas', 'cinzas');
    else if (date < addDays(cinzas, 4)) set('quaresma', 'Tempo da Quaresma', 0, 'x', `${DOWN[dow]} depois das Cinzas`, `quaresma-0-${DOW[dow]}`);
    else {
      const laetare = week === 4 && dow === 0;
      set('quaresma', 'Tempo da Quaresma', week, laetare ? 's' : 'x', dow === 0 ? `${ORDM[week]} Domingo da Quaresma${laetare ? ' (Laetare)' : ''}` : `${DOWN[dow]} da ${ORD[week]} semana da Quaresma`,
        dow === 0 ? `quaresma-${week}-dom-${cycle}` : `quaresma-${week}-${DOW[dow]}`);
    }
  } else if (date < pascoa) {
    if (same(date, ramos)) set('quaresma', 'Semana Santa', 6, 'r', 'Domingo de Ramos da Paixão do Senhor', `ramos-${cycle}`, 'S');
    else if (dow === 4) set('triduo', 'Tríduo Pascal', 6, 'b', 'Quinta-feira Santa — Ceia do Senhor', 'quinta-santa', 'S');
    else if (dow === 5) set('triduo', 'Tríduo Pascal', 6, 'r', 'Sexta-feira Santa — Paixão do Senhor', 'sexta-santa', 'S');
    else if (dow === 6) set('triduo', 'Tríduo Pascal', 6, 'b', 'Sábado Santo — Vigília Pascal', 'sabado-santo', 'S');
    else set('quaresma', 'Semana Santa', 6, 'x', `${DOWN[dow]} da Semana Santa`, `semana-santa-${DOW[dow]}`);
  } else if (date <= pentecostes) {
    const week = Math.floor(days(pascoa, date) / 7) + 1;
    if (same(date, pascoa)) set('pascoa', 'Tempo Pascal', 1, 'b', 'Domingo de Páscoa da Ressurreição do Senhor', 'pascoa', 'S');
    else if (week === 1) set('pascoa', 'Tempo Pascal', 1, 'b', `${DOWN[dow]} da Oitava da Páscoa`, `pascoa-1-${DOW[dow]}`, 'S');
    else if (same(date, pentecostes)) set('pascoa', 'Tempo Pascal', 8, 'r', 'Domingo de Pentecostes', `pentecostes-${cycle}`, 'S');
    else if (same(date, ascensao)) set('pascoa', 'Tempo Pascal', 7, 'b', 'Ascensão do Senhor', `ascensao-${cycle}`, 'S');
    else set('pascoa', 'Tempo Pascal', week, 'b', dow === 0 ? `${ORDM[week]} Domingo da Páscoa${week === 2 ? ' (Divina Misericórdia)' : ''}` : `${DOWN[dow]} da ${ORD[week]} semana da Páscoa`,
      dow === 0 ? `pascoa-${week}-dom-${cycle}` : `pascoa-${week}-${DOW[dow]}`);
  } else {
    // Tempo Comum II — contado a partir do fim (34ª semana termina no sábado antes do Advento)
    const sunOf = sundayOnOrBefore(date);
    const week = 34 - Math.round(days(sunOf, cristoRei) / 7);
    if (same(date, trindade)) set('comum', 'Tempo Comum', week, 'b', 'Santíssima Trindade', `trindade-${cycle}`, 'S');
    else if (same(date, corpus)) set('comum', 'Tempo Comum', week, 'b', 'Corpus Christi — Santíssimo Corpo e Sangue de Cristo', `corpus-christi-${cycle}`, 'S');
    else if (same(date, sagradoCoracao)) set('comum', 'Tempo Comum', week, 'b', 'Sagrado Coração de Jesus', `sagrado-coracao-${cycle}`, 'S');
    else if (same(date, imaculadoCoracao)) set('comum', 'Tempo Comum', week, 'b', 'Imaculado Coração de Maria', `to-${week}-sab-${wcycle}`, 'M');
    else if (same(date, cristoRei)) set('comum', 'Tempo Comum', 34, 'b', 'Cristo Rei do Universo', `cristo-rei-${cycle}`, 'S');
    else set('comum', 'Tempo Comum', week, 'v', dow === 0 ? `${ORDM[week]} Domingo do Tempo Comum` : `${DOWN[dow]} da ${ORD[week]} semana do Tempo Comum`,
      dow === 0 ? `to-${week}-dom-${cycle}` : `to-${week}-${DOW[dow]}-${wcycle}`);
  }
  // Sanctoral: solenidades e festas prevalecem sobre dias de semana (e algumas sobre domingos do Tempo Comum)
  if (sanct) {
    const strong = sanct.r === 'S' || sanct.r === 'F';
    const sundayOverride = sanct.r === 'S' && out.season === 'comum';
    const weekdayOverride = strong && (out.season === 'comum' || (out.season === 'advento' && date < D(litYear, 12, 17)) || (out.season === 'natal' && !out.rank) || (out.season === 'quaresma' && sanct.r === 'S') || (out.season === 'pascoa' && sanct.r === 'S' && out.week > 1));
    if ((dow === 0 && sundayOverride) || (dow !== 0 && weekdayOverride)) {
      out.ferial = { name: out.name, key: out.key };
      out.name = sanct.n; out.rank = sanct.r; out.color = sanct.c;
      if (sanct.key) out.key = sanct.key;
    } else if (!strong || dow !== 0) {
      out.memorial = sanct;
    }
  }
  out.colorName = COLORS[out.color];
  out.colorHex = COLOR_HEX[out.color];
  out.dates = { pascoa, cinzas, ramos, pentecostes, ascensao, trindade, corpus, sagradoCoracao, cristoRei, adv, proxAdv, epifania, batismo, xmas };
  return out;
}

/** Próximas celebrações importantes a partir de uma data (solenidades, festas e datas móveis). */
export function upcoming(from = new Date(), n = 12) {
  const out = [];
  for (let i = 0; i < 400 && out.length < n; i++) {
    const d = addDays(from, i);
    const l = liturgicalDay(d);
    if (l.rank === 'S' || l.rank === 'F' || (l.memorial && l.memorial.r === 'M' && i < 45)) {
      out.push({ date: d, name: l.rank ? l.name : l.memorial.n, rank: l.rank || l.memorial.r, color: l.rank ? l.color : l.memorial.c, season: l.seasonName });
    }
  }
  return out;
}

// ---------- Leituras ----------
let LECT = null;
export async function loadLectionary() {
  if (LECT) return LECT;
  try { const r = await fetch('data/lectionary.json'); LECT = r.ok ? await r.json() : {}; } catch { LECT = {}; }
  return LECT;
}
export async function readingsFor(date = new Date()) {
  const lit = liturgicalDay(date);
  const lect = await loadLectionary();
  const tried = [lit.key];
  let r = lect[lit.key];
  if (!r && lit.ferial) { tried.push(lit.ferial.key); r = lect[lit.ferial.key]; }
  return { lit, readings: r || null, tried };
}
export const SEASON_KEYS = { advento: 'advento', natal: 'natal', comum: 'comum', quaresma: 'quaresma', triduo: 'quaresma', pascoa: 'pascoa' };
