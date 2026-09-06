#!/usr/bin/env python3
"""Build data/lectionary.json: liturgical-day key -> readings (parsed refs), from cpbjr catholic-readings-api dumps
(lect/*.json readings, lectcal/*.json calendar) using the same key scheme as js/liturgy.js."""
import json, os, re, datetime, collections

DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']   # Python: Monday=0 -> we convert

def easter(y):
    a = y % 19; b = y // 100; c = y % 100; d = b // 4; e = b % 4; f = (b + 8) // 25; g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30; i = c // 4; k = c % 4; l = (32 + 2 * e + 2 * i - h - k) % 7; m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31; day = ((h + l - 7 * m + 114) % 31) + 1
    return datetime.date(y, month, day)

def dow(d): return (d.weekday() + 1) % 7   # 0 = Sunday
def sunday_on_or_after(d): return d + datetime.timedelta(days=(7 - dow(d)) % 7)
def sunday_on_or_before(d): return d - datetime.timedelta(days=dow(d))
def advent_start(y):
    xmas = datetime.date(y, 12, 25); w = dow(xmas)
    fourth = xmas - datetime.timedelta(days=(7 if w == 0 else w))
    return fourth - datetime.timedelta(days=21)
D = datetime.timedelta

FIXED_KEYS = {'01-25', '02-02', '02-22', '03-19', '03-25', '04-25', '05-03', '05-14', '05-31', '06-24', '06-29', '07-03', '07-22', '07-25', '08-06', '08-10', '08-15', '08-24', '09-08', '09-14', '09-21', '09-29', '10-12', '10-18', '10-28', '11-01', '11-02', '11-09', '11-30', '12-08'}
SOLEMN = {'03-19', '03-25', '06-24', '06-29', '08-15', '10-12', '11-01', '11-02', '12-08'}

def lit_key(date):
    y = date.year
    adv = advent_start(y); lit_year = y
    if date < adv: adv = advent_start(y - 1); lit_year = y - 1
    cycle = ['C', 'A', 'B'][(lit_year + 1) % 3]
    wcycle = 'I' if (lit_year + 1) % 2 == 1 else 'II'
    xmas = datetime.date(lit_year, 12, 25); cy = lit_year + 1
    pascoa = easter(cy); cinzas = pascoa - D(46); ramos = pascoa - D(7); pentecostes = pascoa + D(49)
    ascensao = pascoa + D(42); trindade = pascoa + D(56); corpus = pascoa + D(60); sagrado = pascoa + D(68)
    epifania = sunday_on_or_after(datetime.date(cy, 1, 2))
    batismo = epifania + D(7) if epifania.day < 7 else epifania + D(1)
    prox_adv = advent_start(cy); cristo_rei = prox_adv - D(7)
    w = dow(date); mmdd = date.strftime('%m-%d')
    key = None; season = None
    if adv <= date < xmas:
        week = (date - adv).days // 7 + 1; season = 'advento'
        if w == 0: key = f'adv-{week}-dom-{cycle}'
        elif date >= datetime.date(lit_year, 12, 17): key = f'adv-{mmdd}'
        else: key = f'adv-{week}-{DOW[w]}'
    elif xmas <= date < batismo:
        season = 'natal'
        sf = datetime.date(lit_year, 12, 30) if dow(xmas) == 0 else sunday_on_or_after(xmas + D(1))
        if date == xmas: key = 'natal-12-25'
        elif date == sf: key = f'sagrada-familia-{cycle}'
        elif date == datetime.date(cy, 1, 1): key = 'maria-mae-de-deus'
        elif date == epifania: key = 'epifania'
        elif date > epifania: key = f'epif-{DOW[w]}'
        elif date > datetime.date(cy, 1, 1): key = 'natal-dom2' if w == 0 else f'natal-{mmdd}'
        else: key = f'natal-{mmdd}'
    elif date == batismo:
        season = 'natal'; key = f'batismo-{cycle}'
    elif date < cinzas:
        season = 'comum'
        sun1 = batismo if dow(batismo) == 0 else batismo - D(1)
        week = (date - sun1).days // 7 + 1
        key = f'to-{week}-dom-{cycle}' if w == 0 else f'to-{week}-{DOW[w]}-{wcycle}'
    elif date < ramos:
        season = 'quaresma'
        week = (date - (cinzas + D(4))).days // 7 + 1
        if date == cinzas: key = 'cinzas'
        elif date < cinzas + D(4): key = f'quaresma-0-{DOW[w]}'
        else: key = f'quaresma-{week}-dom-{cycle}' if w == 0 else f'quaresma-{week}-{DOW[w]}'
    elif date < pascoa:
        season = 'quaresma'
        if date == ramos: key = f'ramos-{cycle}'
        elif w == 4: key = 'quinta-santa'
        elif w == 5: key = 'sexta-santa'
        elif w == 6: key = 'sabado-santo'
        else: key = f'semana-santa-{DOW[w]}'
    elif date <= pentecostes:
        season = 'pascoa'
        week = (date - pascoa).days // 7 + 1
        if date == pascoa: key = 'pascoa'
        elif week == 1: key = f'pascoa-1-{DOW[w]}'
        elif date == pentecostes: key = f'pentecostes-{cycle}'
        elif date == ascensao: key = f'ascensao-{cycle}'
        else: key = f'pascoa-{week}-dom-{cycle}' if w == 0 else f'pascoa-{week}-{DOW[w]}'
    else:
        season = 'comum'
        sun_of = sunday_on_or_before(date)
        week = 34 - round((cristo_rei - sun_of).days / 7)
        if date == trindade: key = f'trindade-{cycle}'
        elif date == corpus: key = f'corpus-christi-{cycle}'
        elif date == sagrado: key = f'sagrado-coracao-{cycle}'
        elif date == cristo_rei: key = f'cristo-rei-{cycle}'
        else: key = f'to-{week}-dom-{cycle}' if w == 0 else f'to-{week}-{DOW[w]}-{wcycle}'
    ferial = key
    base = key
    if season == 'comum' and not key.startswith('to-') and 'week' in dir():
        base = f'to-{week}-dom-{cycle}' if w == 0 else f'to-{week}-{DOW[w]}-{wcycle}'
    # fixed feasts/solemnities override weekdays (and solemnities override OT Sundays)
    if mmdd in FIXED_KEYS:
        strong = True
        if (w == 0 and mmdd in SOLEMN and season == 'comum') or (w != 0 and (season == 'comum' or (season == 'advento' and date < datetime.date(lit_year, 12, 17)) or (season == 'natal' and key.startswith(('natal-', 'epif-'))) or (season == 'quaresma' and mmdd in SOLEMN) or (season == 'pascoa' and mmdd in SOLEMN and week > 1))):
            key = f'f-{mmdd}'
    return key, base, cycle, wcycle

# --- reference parsing (English USCCB style -> our ids) ---
EN = {
 'genesis': 'gn', 'exodus': 'ex', 'leviticus': 'lv', 'numbers': 'nm', 'deuteronomy': 'dt', 'joshua': 'js', 'judges': 'jz', 'ruth': 'rt',
 '1 samuel': '1sm', '2 samuel': '2sm', '1 kings': '1rs', '2 kings': '2rs', '1 chronicles': '1cr', '2 chronicles': '2cr', 'ezra': 'esd', 'nehemiah': 'ne',
 'tobit': 'tb', 'judith': 'jt', 'esther': 'est', '1 maccabees': '1mc', '2 maccabees': '2mc', 'job': 'job', 'psalm': 'sl', 'psalms': 'sl', 'proverbs': 'pr',
 'ecclesiastes': 'ecl', 'song of songs': 'ct', 'songs': 'ct', 'song of solomon': 'ct', 'wisdom': 'sb', 'sirach': 'eclo', 'ecclesiasticus': 'eclo', 'isaiah': 'is',
 'jeremiah': 'jr', 'lamentations': 'lm', 'baruch': 'br', 'ezekiel': 'ez', 'daniel': 'dn', 'hosea': 'os', 'joel': 'jl', 'amos': 'am', 'obadiah': 'ab',
 'jonah': 'jn', 'micah': 'mq', 'nahum': 'na', 'habakkuk': 'hab', 'zephaniah': 'sf', 'haggai': 'ag', 'zechariah': 'zc', 'malachi': 'ml',
 'matthew': 'mt', 'mark': 'mc', 'luke': 'lc', 'john': 'jo', 'acts': 'at', 'acts of the apostles': 'at', 'romans': 'rm', '1 corinthians': '1cor', '2 corinthians': '2cor',
 'galatians': 'gl', 'ephesians': 'ef', 'philippians': 'fl', 'colossians': 'cl', '1 thessalonians': '1ts', '2 thessalonians': '2ts', '1 timothy': '1tm', '2 timothy': '2tm',
 'titus': 'tt', 'philemon': 'fm', 'hebrews': 'hb', 'james': 'tg', '1 peter': '1pd', '2 peter': '2pd', '1 john': '1jo', '2 john': '2jo', '3 john': '3jo', 'jude': 'jd', 'revelation': 'ap',
}
books = json.load(open('books.json'))
ABBR = {b['id']: b['abbr'] for b in books}
NCH = {b['id']: None for b in books}

def ps_vulg(n):
    """Hebrew psalm number -> Vulgate number (approx.; 9/10 and 114/115 merge, 116 and 147 split)."""
    if n <= 8: return n
    if n in (9, 10): return 9
    if 11 <= n <= 113: return n - 1
    if n in (114, 115): return 113
    if n == 116: return 114
    if 117 <= n <= 146: return n - 1
    if n == 147: return 146
    return n

def parse_ref(s):
    if not s: return None
    raw = s.strip()
    first = re.split(r'\s+or\s+', raw)[0]
    m = re.match(r'^((?:[1-3]\s+)?[A-Za-z][A-Za-z ]+?)\s+(\d+)(?::([\d\w,\-–—:;\s]+))?$', first.strip())
    if not m:
        return {'raw': raw}
    name = m.group(1).strip().lower(); ch = int(m.group(2)); vs = (m.group(3) or '').strip()
    bid = EN.get(name)
    if not bid:
        return {'raw': raw}
    v1 = None
    mv = re.match(r'(\d+)', vs)
    if mv: v1 = int(mv.group(1))
    disp_vs = vs.replace(':', ',').replace('—', '–')
    if bid == 'sl':
        vc = ps_vulg(ch)
        disp = f'Sl {vc} ({ch})' + (f',{disp_vs}' if disp_vs else '')
        return {'raw': raw, 'b': 'sl', 'c': vc, 'heb': ch, 'v': vs, 'disp': disp}
    disp = f'{ABBR[bid]} {ch}' + (f',{disp_vs}' if disp_vs else '')
    out = {'raw': raw, 'b': bid, 'c': ch, 'v': vs, 'disp': disp}
    if v1: out['v1'] = v1
    return out

if __name__ == '__main__':
    lect = {}
    conflicts = 0
    dates = sorted(f[:-5] for f in os.listdir('lect') if f.endswith('.json') and f[0] == '2')
    for ds in dates:
        d = datetime.date.fromisoformat(ds)
        r = json.load(open(f'lect/{ds}.json'))
        cal = json.load(open(f'lectcal/{ds}.json')) if os.path.exists(f'lectcal/{ds}.json') else {}
        cname = (cal.get('celebration') or {}).get('name', '')
        key, ferial, cycle, wcycle = lit_key(d)
        rd = r.get('readings') or {}
        entry = {k: parse_ref(rd.get(src)) for k, src in (('first', 'firstReading'), ('psalm', 'psalm'), ('second', 'secondReading'), ('gospel', 'gospel'))}
        entry = {k: v for k, v in entry.items() if v}
        if not entry: continue
        entry['src_date'] = ds; entry['src_name'] = cname
        # US transfers: Ascension Thursday readings -> ascensao key; 7th Sunday of Easter in US -> pascoa-7-dom
        low = cname.lower()
        ctype = ((cal.get('celebration') or {}).get('type') or '').upper()
        if key.startswith('f-') and ctype not in ('SOLEMNITY', 'FEAST'):
            key = ferial   # US did not celebrate the feast that day: readings are ferial
        if key == 'f-10-12':
            continue       # Nossa Senhora Aparecida (Brasil): tabela própria
        if key.startswith('corpus-christi-') and 'corpus' not in low and 'body and blood' not in low:
            lect.setdefault(ferial, dict(entry)); continue
        if 'ascension' in low and dow(d) == 4:
            k2 = f'ascensao-{cycle}'
            lect.setdefault(k2, dict(entry))
            continue
        if key.startswith('ascensao-') and '7th sunday' in low:
            lect.setdefault(f'pascoa-7-dom-{cycle}', dict(entry))
            continue
        if dow(d) == 0 and key.startswith('to-') and ('corpus' in low or 'body and blood' in low):
            lect.setdefault(f'corpus-christi-{cycle}', dict(entry)); continue
        if 'thanksgiving' in low:
            continue
        if key in lect and lect[key].get('gospel', {}).get('raw') != entry.get('gospel', {}).get('raw'):
            conflicts += 1
            continue
        lect.setdefault(key, entry)
    PT = {b['abbr'].lower().replace(' ', ''): b['id'] for b in books}
    PT.update({'jó': 'job', 'jo': 'jo', 'sl': 'sl'})
    def pref(t):
        m = re.match(r'^([1-3]?[A-Za-zÀ-ÿ]+)\s+(\d+)(?:[,.:](.*))?$', t.strip())
        if not m: return {'raw': t}
        bid = PT.get(m.group(1).lower())
        if not bid: return {'raw': t}
        ch = int(m.group(2)); vs = (m.group(3) or '').strip()
        v1 = None
        mv = re.match(r'(\d+)', vs)
        if mv: v1 = int(mv.group(1))
        if bid == 'sl':
            mh = re.match(r'^(\d+)\((\d+)\)$', m.group(1) + m.group(2)) 
        out = {'raw': t, 'b': bid, 'c': ch, 'v': vs, 'disp': t}
        if v1: out['v1'] = v1
        return out
    def add(key, first, psalm, second, gospel, note=None):
        if key in lect: return
        e = {'first': pref(first), 'psalm': pref(psalm)}
        if second: e['second'] = pref(second)
        e['gospel'] = pref(gospel)
        e['src_name'] = 'tabela complementar'
        if note: e['note'] = note
        lect[key] = e
    SUP = [
     ('f-10-12', 'Est 5,1b-2;7,2b-3', 'Sl 44 (45),10bc.11.12ab', 'Ap 12,1.5.13a.15-16a', 'Jo 2,1-11', 'Solenidade de Nossa Senhora da Conceição Aparecida, Padroeira do Brasil.'),
     ('to-10-dom-A', 'Os 6,3-6', 'Sl 49 (50),1.8.12-13.14-15', 'Rm 4,18-25', 'Mt 9,9-13'),
     ('to-9-dom-B', 'Dt 5,12-15', 'Sl 80 (81),3-4.5-6ab.6c-8a.10-11ab', '2Cor 4,6-11', 'Mc 2,23–3,6'),
     ('pascoa-6-qui', 'At 18,1-8', 'Sl 97 (98),1.2-3ab.3cd-4', None, 'Jo 16,16-20'),
     ('batismo-C', 'Is 40,1-5.9-11', 'Sl 103 (104),1b-2.3-4.24-25.27-28.29-30', 'Tt 2,11-14;3,4-7', 'Lc 3,15-16.21-22'),
     ('to-2-dom-C', 'Is 62,1-5', 'Sl 95 (96),1-2a.2b-3.7-8a.9-10ac', '1Cor 12,4-11', 'Jo 2,1-11'),
     ('to-3-dom-C', 'Ne 8,2-4a.5-6.8-10', 'Sl 18 (19),8.9.10.15', '1Cor 12,12-30', 'Lc 1,1-4;4,14-21'),
     ('to-4-dom-C', 'Jr 1,4-5.17-19', 'Sl 70 (71),1-2.3-4a.5-6ab.15ab.17', '1Cor 12,31–13,13', 'Lc 4,21-30'),
     ('to-5-dom-C', 'Is 6,1-2a.3-8', 'Sl 137 (138),1-2a.2bc-3.4-5.7c-8', '1Cor 15,1-11', 'Lc 5,1-11'),
     ('to-6-dom-C', 'Jr 17,5-8', 'Sl 1,1-2.3.4.6', '1Cor 15,12.16-20', 'Lc 6,17.20-26'),
     ('to-7-dom-C', '1Sm 26,2.7-9.12-13.22-23', 'Sl 102 (103),1-2.3-4.8.10.12-13', '1Cor 15,45-49', 'Lc 6,27-38'),
     ('to-8-dom-C', 'Eclo 27,4-7', 'Sl 91 (92),2-3.13-14.15-16', '1Cor 15,54-58', 'Lc 6,39-45'),
     ('to-9-dom-C', '1Rs 8,41-43', 'Sl 116 (117),1.2', 'Gl 1,1-2.6-10', 'Lc 7,1-10'),
     ('to-10-dom-C', '1Rs 17,17-24', 'Sl 29 (30),2.4.5-6.11-12a.13b', 'Gl 1,11-19', 'Lc 7,11-17'),
     ('to-11-dom-C', '2Sm 12,7-10.13', 'Sl 31 (32),1-2.5.7.11', 'Gl 2,16.19-21', 'Lc 7,36–8,3'),
     ('to-12-dom-C', 'Zc 12,10-11;13,1', 'Sl 62 (63),2.3-4.5-6.8-9', 'Gl 3,26-29', 'Lc 9,18-24'),
     ('to-13-dom-C', '1Rs 19,16b.19-21', 'Sl 15 (16),1-2.5.7-8.9-10.11', 'Gl 5,1.13-18', 'Lc 9,51-62'),
     ('to-14-dom-C', 'Is 66,10-14c', 'Sl 65 (66),1-3.4-5.6-7.16.20', 'Gl 6,14-18', 'Lc 10,1-12.17-20'),
     ('to-15-dom-C', 'Dt 30,10-14', 'Sl 68 (69),14.17.30-31.33-34.36ab.37', 'Cl 1,15-20', 'Lc 10,25-37'),
     ('to-16-dom-C', 'Gn 18,1-10a', 'Sl 14 (15),2-3ab.3cd-4ab.5', 'Cl 1,24-28', 'Lc 10,38-42'),
     ('to-17-dom-C', 'Gn 18,20-32', 'Sl 137 (138),1-2a.2bc-3.6-7ab.7c-8', 'Cl 2,12-14', 'Lc 11,1-13'),
     ('to-18-dom-C', 'Ecl 1,2;2,21-23', 'Sl 89 (90),3-4.5-6.12-13.14.17', 'Cl 3,1-5.9-11', 'Lc 12,13-21'),
     ('to-19-dom-C', 'Sb 18,6-9', 'Sl 32 (33),1.12.18-19.20-22', 'Hb 11,1-2.8-19', 'Lc 12,32-48'),
     ('to-20-dom-C', 'Jr 38,4-6.8-10', 'Sl 39 (40),2.3.4.18', 'Hb 12,1-4', 'Lc 12,49-53'),
     ('to-21-dom-C', 'Is 66,18-21', 'Sl 116 (117),1.2', 'Hb 12,5-7.11-13', 'Lc 13,22-30'),
     ('quaresma-1-dom-C', 'Dt 26,4-10', 'Sl 90 (91),1-2.10-11.12-13.14-15', 'Rm 10,8-13', 'Lc 4,1-13'),
     ('quaresma-2-dom-C', 'Gn 15,5-12.17-18', 'Sl 26 (27),1.7-8.8-9.13-14', 'Fl 3,17–4,1', 'Lc 9,28b-36'),
     ('quaresma-3-dom-C', 'Ex 3,1-8a.13-15', 'Sl 102 (103),1-2.3-4.6-7.8.11', '1Cor 10,1-6.10-12', 'Lc 13,1-9'),
     ('quaresma-4-dom-C', 'Js 5,9a.10-12', 'Sl 33 (34),2-3.4-5.6-7', '2Cor 5,17-21', 'Lc 15,1-3.11-32'),
     ('quaresma-5-dom-C', 'Is 43,16-21', 'Sl 125 (126),1-2ab.2cd-3.4-5.6', 'Fl 3,8-14', 'Jo 8,1-11'),
     ('ramos-C', 'Is 50,4-7', 'Sl 21 (22),8-9.17-18a.19-20.23-24', 'Fl 2,6-11', 'Lc 22,14–23,56', 'Procissão de Ramos: Lc 19,28-40.'),
     ('pascoa-2-dom-C', 'At 5,12-16', 'Sl 117 (118),2-4.13-15.22-24', 'Ap 1,9-11a.12-13.17-19', 'Jo 20,19-31'),
     ('pascoa-3-dom-C', 'At 5,27b-32.40b-41', 'Sl 29 (30),2.4.5-6.11-12a.13b', 'Ap 5,11-14', 'Jo 21,1-19'),
     ('pascoa-4-dom-C', 'At 13,14.43-52', 'Sl 99 (100),1-2.3.5', 'Ap 7,9.14b-17', 'Jo 10,27-30'),
     ('pascoa-5-dom-C', 'At 14,21-27', 'Sl 144 (145),8-9.10-11.12-13ab', 'Ap 21,1-5a', 'Jo 13,31-33a.34-35'),
     ('pascoa-6-dom-C', 'At 15,1-2.22-29', 'Sl 66 (67),2-3.5.6.8', 'Ap 21,10-14.22-23', 'Jo 14,23-29'),
     ('ascensao-C', 'At 1,1-11', 'Sl 46 (47),2-3.6-7.8-9', 'Ef 1,17-23', 'Lc 24,46-53'),
     ('pascoa-7-dom-C', 'At 7,55-60', 'Sl 96 (97),1-2.6-7.9', 'Ap 22,12-14.16-17.20', 'Jo 17,20-26'),
     ('pentecostes-C', 'At 2,1-11', 'Sl 103 (104),1ab.24ac.29bc-30.31.34', 'Rm 8,8-17', 'Jo 14,15-16.23b-26'),
     ('trindade-C', 'Pr 8,22-31', 'Sl 8,4-5.6-7.8-9', 'Rm 5,1-5', 'Jo 16,12-15'),
     ('corpus-christi-C', 'Gn 14,18-20', 'Sl 109 (110),1.2.3.4', '1Cor 11,23-26', 'Lc 9,11b-17'),
     ('sagrado-coracao-C', 'Ez 34,11-16', 'Sl 22 (23),1-3a.3b-4.5.6', 'Rm 5,5b-11', 'Lc 15,3-7'),
     ('to-4-seg-II', '2Sm 15,13-14.30;16,5-13a', 'Sl 3,2-3.4-5.6-7', None, 'Mc 5,1-20'),
     ('to-6-qua-II', 'Tg 1,19-27', 'Sl 14 (15),2-3ab.3cd-4ab.5', None, 'Mc 8,22-26'),
     ('to-7-seg-II', 'Tg 3,13-18', 'Sl 18 (19),8.9.10.15', None, 'Mc 9,14-29'),
     ('to-7-ter-II', 'Tg 4,1-10', 'Sl 54 (55),7-8.9-10a.10b-11a.23', None, 'Mc 9,30-37'),
     ('to-7-qua-II', 'Tg 4,13-17', 'Sl 48 (49),2-3.6-7.8-10.11', None, 'Mc 9,38-40'),
     ('to-7-qui-II', 'Tg 5,1-6', 'Sl 48 (49),14-15ab.15cd-16.17-18.19-20', None, 'Mc 9,41-50'),
     ('to-7-sex-II', 'Tg 5,9-12', 'Sl 102 (103),1-2.3-4.8-9.11-12', None, 'Mc 10,1-12'),
     ('to-7-sab-II', 'Tg 5,13-20', 'Sl 140 (141),1-2.3.8', None, 'Mc 10,13-16'),
     ('to-8-seg-II', '1Pd 1,3-9', 'Sl 110 (111),1-2.5-6.9.10c', None, 'Mc 10,17-27'),
     ('to-8-ter-II', '1Pd 1,10-16', 'Sl 97 (98),1.2-3ab.3cd-4', None, 'Mc 10,28-31'),
     ('to-8-qua-II', '1Pd 1,18-25', 'Sl 147 (147B),12-13.14-15.19-20', None, 'Mc 10,32-45'),
     ('to-8-qui-II', '1Pd 2,2-5.9-12', 'Sl 99 (100),2.3.4.5', None, 'Mc 10,46-52'),
     ('to-8-sex-II', '1Pd 4,7-13', 'Sl 95 (96),10.11-12.13', None, 'Mc 11,11-26'),
     ('to-8-sab-II', 'Jd 17.20b-25', 'Sl 62 (63),2.3-4.5-6', None, 'Mc 11,27-33'),
    ]
    for row in SUP: add(*row)
    print('keys', len(lect), 'conflicts', conflicts)
    # coverage report for the next liturgical years
    missing = collections.Counter()
    for y in (2026, 2027, 2028):
        d = datetime.date(y, 1, 1)
        while d.year == y:
            key, ferial, cycle, wcycle = lit_key(d)
            if key not in lect and ferial not in lect: missing[key.split('-')[0] + ('-' + key.split('-')[-1] if key.startswith(('to-', 'adv-', 'quaresma-', 'pascoa-')) and key.split('-')[-1] in ('A', 'B', 'C', 'I', 'II') else '')] += 1
            d += D(1)
    print('missing by type (2026-2028):', missing.most_common())
    os.makedirs('out/data', exist_ok=True)
    json.dump(lect, open('out/data/lectionary.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    missing_keys = []
    for y in (2026, 2027, 2028):
        d = datetime.date(y, 1, 1)
        while d.year == y:
            key, ferial, cycle, wcycle = lit_key(d)
            if key not in lect and ferial not in lect: missing_keys.append((d.isoformat(), key))
            d += D(1)
    json.dump(missing_keys, open('lect_missing.json', 'w'))
    print('missing days', len(missing_keys), missing_keys[:12])
