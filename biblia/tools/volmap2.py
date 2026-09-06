#!/usr/bin/env python3
"""Map (book, chapter) -> (volume, page range) using the running heads of the 1950 edition volumes 01..12."""
import pymupdf, re, json, collections, unicodedata, difflib
books = json.load(open('books.json'))
vul = json.load(open('VULG.json'))
nch = collections.defaultdict(int)
for v in vul: nch[v['book']] = max(nch[v['book']], v['chapter'])
byid = {b['id']: b for b in books}

def strip(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'[^a-z0-9 ]+', ' ', s).strip()

# canonical head names (normalised) per book id; ordinal handled separately
CANON = {
    'gn': ['genesis'], 'ex': ['exodo'], 'lv': ['levitico'], 'nm': ['numeros'], 'dt': ['deuteronomio'], 'js': ['josue'], 'jz': ['juizes'], 'rt': ['rute'],
    '1sm': ['1 reis'], '2sm': ['2 reis'], '1rs': ['3 reis'], '2rs': ['4 reis'], '1cr': ['1 paralipomenos'], '2cr': ['2 paralipomenos'],
    'esd': ['1 esdras'], 'ne': ['2 esdras'], 'tb': ['tobias'], 'jt': ['judite'], 'est': ['ester'], 'job': ['jo'], 'sl': ['salmo'], 'pr': ['proverbios'],
    'ecl': ['eclesiastes'], 'ct': ['o cantico dos canticos', 'cantico dos canticos'], 'sb': ['a sabedoria', 'sabedoria'], 'eclo': ['eclesiastico'],
    'is': ['isaias'], 'jr': ['jeremias'], 'lm': ['lamentacoes de jeremias', 'lamentacoes'], 'br': ['baruc'], 'ez': ['ezequiel'], 'dn': ['daniel'],
    'os': ['oseias'], 'jl': ['joel'], 'am': ['amos'], 'ab': ['abdias'], 'jn': ['jonas'], 'mq': ['miqueias'], 'na': ['naum'], 'hab': ['habacuc'],
    'sf': ['sofonias'], 'ag': ['ageu'], 'zc': ['zacarias'], 'ml': ['malaquias'], '1mc': ['1 macabeus'], '2mc': ['2 macabeus'],
    'mt': ['evangelho de s mateus'], 'mc': ['evangelho de s marcos'], 'lc': ['evangelho de s lucas'], 'jo': ['evangelho de s joao'],
    'at': ['atos dos apostolos'], 'rm': ['epistola de s paulo aos romanos'], '1cor': ['1 epistola de s paulo aos corintios'], '2cor': ['2 epistola de s paulo aos corintios'],
    'gl': ['epistola de s paulo aos galatas'], 'ef': ['epistola de s paulo aos efesios'], 'fl': ['epistola de s paulo aos filipenses'], 'cl': ['epistola de s paulo aos colossenses'],
    '1ts': ['1 epistola de s paulo aos tessalonicenses'], '2ts': ['2 epistola de s paulo aos tessalonicenses'], '1tm': ['1 epistola de s paulo a timoteo'], '2tm': ['2 epistola de s paulo a timoteo'],
    'tt': ['epistola de s paulo a tito'], 'fm': ['epistola de s paulo a filemon'], 'hb': ['epistola de s paulo aos hebreus'], 'tg': ['epistola de s tiago apostolo'],
    '1pd': ['1 epistola de s pedro apostolo'], '2pd': ['2 epistola de s pedro apostolo'], '1jo': ['1 epistola de s joao apostolo'], '2jo': ['2 epistola de s joao apostolo'], '3jo': ['3 epistola de s joao apostolo'],
    'jd': ['epistola de s judas apostolo'], 'ap': ['apocalipse de s joao apostolo'],
}
VOL_BOOKS = {  # books expected per volume (limits fuzzy matching)
    '01': ['gn', 'ex', 'lv'], '02': ['nm', 'dt', 'js', 'jz', 'rt'], '03': ['1sm', '2sm', '1rs', '2rs', '1cr'],
    '04': ['2cr', 'esd', 'ne', 'tb', 'jt', 'est', 'job'], '05': ['sl', 'pr'], '06': ['pr', 'ecl', 'ct', 'sb', 'eclo', 'is'],
    '07': ['is', 'jr', 'lm'], '08': ['br', 'ez', 'dn', 'os'], '09': ['jl', 'am', 'ab', 'jn', 'mq', 'na', 'hab', 'sf', 'ag', 'zc', 'ml', '1mc', '2mc'],
    '10': ['mt', 'mc', 'lc'], '11': ['jo', 'at', 'rm', '1cor'], '12': ['2cor', 'gl', 'ef', 'fl', 'cl', '1ts', '2ts', '1tm', '2tm', 'tt', 'fm', 'hb', 'tg', '1pd', '2pd', '1jo', '2jo', '3jo', 'jd', 'ap'],
}
ORD = {'l': '1', 'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'j': '1'}

def parse_head(text, vol):
    """Return (book_id, [chapters]) or (None, [])."""
    t = text.strip()
    # OCR fixes
    t = t.replace('·', '').replace('•', '').replace('_', '').replace('~', '')
    t = re.sub(r"l\\'l", 'M', t)
    # split name / numbers: numbers part starts at first "<digits>," pattern
    m = re.search(r'\s(\d{1,3})\s*[,.]\s*[\d]', t)
    name = t[:m.start()] if m else re.sub(r'[\d,;:\-–—.\s]+$', '', t)
    nums = t[m.start():] if m else ''
    chapters = []
    for mm in re.finditer(r'(\d{1,3})\s*[,.]\s*[\d]', nums):
        chapters.append(int(mm.group(1)))
    n = strip(name)
    n = re.sub(r'^(\S+)\s*a\s+', r'\1 ', n)   # "1.ª" -> "1 a" -> "1"
    n = re.sub(r'^\s*(l|i|ii|iii|iv|j)\s+', lambda mm: ORD[mm.group(1)] + ' ', n)
    n = re.sub(r'\s+', ' ', n).strip()
    if not n:
        return None, chapters
    best, score = None, 0
    for bid in VOL_BOOKS.get(vol, []):
        for cand in CANON[bid]:
            r = difflib.SequenceMatcher(None, n, cand).ratio()
            # ordinal must agree if both present
            o1 = re.match(r'^(\d)\s', n); o2 = re.match(r'^(\d)\s', cand)
            if o1 and o2 and o1.group(1) != o2.group(1):
                r -= 0.3
            if (o1 is None) != (o2 is None):
                r -= 0.15
            if r > score:
                best, score = bid, r
    if score < 0.62:
        return None, chapters
    return best, chapters

if __name__ == '__main__':
    pages_map = {}   # vol -> list of (book, chapters)
    for vol in sorted(VOL_BOOKS):
        doc = pymupdf.open(f'vols/vol{vol}.pdf')
        out = []
        for p in range(len(doc)):
            d = doc[p].get_text('dict')
            first = ''
            for b in d['blocks']:
                if b['type'] != 0: continue
                for l in b['lines']:
                    if l['bbox'][1] < 26:
                        t = ''.join(s['text'] for s in l['spans']).strip()
                        if len(t) > 2: first = (first + ' ' + t).strip()
            bid, chs = parse_head(first, vol) if first else (None, [])
            out.append([bid, chs, first[:60]])
        pages_map[vol] = out
        print(vol, len(out), collections.Counter(x[0] for x in out).most_common(25))
    json.dump(pages_map, open('vol_pages.json', 'w'), ensure_ascii=False)
    # build chapter ranges
    ranges = {}
    for vol, out in pages_map.items():
        # fill unknown book by neighbour continuity
        for i, x in enumerate(out):
            if x[0] is None and i > 0 and out[i - 1][0] and i + 1 < len(out) and out[i + 1][0] == out[i - 1][0]:
                x[0] = out[i - 1][0]
        for bid in VOL_BOOKS[vol]:
            for c in range(1, nch[byid[bid]['bolls']] + 1):
                ps = [i for i, x in enumerate(out) if x[0] == bid and c in x[1]]
                if ps:
                    key = f'{bid}.{c}'
                    lo, hi = min(ps), max(ps)
                    if key in ranges:   # book spans two volumes (pr, is): keep both
                        ranges[key].append([vol, lo, hi])
                    else:
                        ranges[key] = [[vol, lo, hi]]
    # fill missing chapters by interpolation between neighbours in same book/volume
    filled = 0
    for bid in byid:
        n = nch[byid[bid]['bolls']]
        for c in range(1, n + 1):
            key = f'{bid}.{c}'
            if key in ranges: continue
            prev = ranges.get(f'{bid}.{c-1}'); nxt = ranges.get(f'{bid}.{c+1}')
            if prev and nxt and prev[-1][0] == nxt[0][0]:
                ranges[key] = [[prev[-1][0], prev[-1][2], nxt[0][1]]]; filled += 1
            elif prev:
                ranges[key] = [[prev[-1][0], prev[-1][2], prev[-1][2] + 6]]; filled += 1
            elif nxt:
                ranges[key] = [[nxt[0][0], max(0, nxt[0][1] - 6), nxt[0][1]]]; filled += 1
    missing = [f'{bid}.{c}' for bid in byid for c in range(1, nch[byid[bid]['bolls']] + 1) if f'{bid}.{c}' not in ranges]
    print('ranges', len(ranges), 'filled', filled, 'missing', len(missing), missing[:30])
    json.dump(ranges, open('vol_ranges.json', 'w'))
