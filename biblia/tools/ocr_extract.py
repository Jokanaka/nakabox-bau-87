#!/usr/bin/env python3
"""Extract verses of one chapter from a per-chapter PDF (1950 Figueiredo edition, OCR text layer).

Usage as module:  extract_chapter(pdf_path, chapter_number, lexicon) -> dict
Returns {'ok':bool,'title':str,'verses':{n:text},'heading':str|None,'warnings':[...]}
"""
import re, statistics, unicodedata
import pymupdf

CAP_RE = re.compile(r'(?:c\s*a\s*p\s*[íiìl1!|frtj]?\s*t\s*u\s*l\s*[o0]|c\s*a\s*p\s*[^\s\d]{2,8}|salmo)\s*[^0-9a-zA-ZÀ-ÿ]{0,3}\s*([0-9lIOoSB]{1,3})\b', re.I)
CAPWORD_RE = re.compile(r'^\s*c\s*a\s*p\s*.{0,2}\s*t\s*u\s*l\s*[o0]', re.I)
PAGENUM_RE = re.compile(r'^[\s\-—–_.·•]*\d{1,4}[\s\-—–_.·•]*$')
FN_LABEL_RE = re.compile(r'^\s*[(\[]\s*[\d*]{1,3}\s*[)\]jJ}]\s*')
INLINE_FN_RE = re.compile(r'\(\s*[\d*]{1,3}\s*\)')
DIGIT_FIX = str.maketrans({'l': '1', 'I': '1', 'O': '0', 'o': '0', 'S': '5', 'B': '8', 'Z': '2', 'i': '1', '!': '1', '|': '1', 'Í': '1', 'í': '1', 'ì': '1', 'ï': '1', 'j': '1', 'J': '1', 'T': '1', 'Q': '0', 'D': '0', 'G': '6', 'Ó': '0', 'ó': '0', 'ô': '0', 'Ô': '0'})

MAIN_MIN_SIZE = 9.05      # verse text is ~9.4-10.1 pt; footnotes ~7.1-8.6; summary ~7-8.2
HEADER_MAX_Y = 24         # running heads sit at y ~ 12-18


def norm_int(s):
    s = s.translate(DIGIT_FIX)
    return int(s) if s.isdigit() else None


def caps_ratio(t):
    letters = [ch for ch in t if ch.isalpha()]
    if len(letters) < 3:
        return 0.0
    up = sum(1 for ch in letters if ch.isupper())
    return up / len(letters)


def page_rows(pg):
    d = pg.get_text('dict')
    rows = []
    for b in d['blocks']:
        if b['type'] != 0:
            continue
        for l in b['lines']:
            spans = [s for s in l['spans'] if s['text'].strip()]
            if not spans:
                continue
            txt = ''.join(s['text'] for s in l['spans'])
            sizes = []
            for s in spans:
                sizes += [s['size']] * max(1, len(s['text'].strip()))
            size = statistics.median(sizes)
            x0, y0, x1, y1 = l['bbox']
            rows.append({'x': x0, 'y': y0, 'y1': y1, 'size': size, 'text': txt, 'n': len(txt.strip())})
    rows.sort(key=lambda r: (round(r['y']), r['x']))
    merged = []
    for r in rows:
        if merged:
            m = merged[-1]
            cy_r = (r['y'] + r['y1']) / 2
            cy_m = (m['y'] + m['y1']) / 2
            if abs(cy_r - cy_m) < 3.5:
                if r['x'] >= m['x']:
                    m['text'] = m['text'].rstrip() + ' ' + r['text'].lstrip()
                else:
                    m['text'] = r['text'].rstrip() + ' ' + m['text'].lstrip()
                    m['x'] = r['x']
                if r['n'] > m['n']:
                    m['size'] = r['size']
                m['n'] += r['n']
                m['y1'] = max(m['y1'], r['y1'])
                continue
        merged.append(dict(r))
    return merged


def doc_rows(pdf_path, page_subset=None):
    doc = pymupdf.open(pdf_path) if isinstance(pdf_path, str) else pdf_path
    pages = []
    idxs = list(range(len(doc))) if page_subset is None else list(page_subset)
    for pi in idxs:
        pages.append(page_rows(doc[pi]))
    # adaptive main-text size: median size of verse-start lines per page, fallback to doc median
    vs_re = re.compile(r'^[^0-9A-Za-zÀ-ÿ"“«(\[]*[0-9lIOoSB!|]{1,3}\s+[A-Za-zÀ-ÿ"“(]')
    doc_sizes = []
    page_main = []
    for rows in pages:
        sz = [r['size'] for r in rows if vs_re.match(r['text']) and r['y'] >= HEADER_MAX_Y and len(r['text'].strip()) > 12]
        page_main.append(statistics.median(sz) if len(sz) >= 2 else None)
        doc_sizes += sz
    doc_main = statistics.median(doc_sizes) if doc_sizes else 9.5
    out = []
    for pi, rows in enumerate(pages):
        M = page_main[pi] if page_main[pi] is not None else doc_main
        big_min = M - 0.55
        small_max = M - 0.9
        in_fn = False
        seen_big_on_page = False
        for r in rows:
            t = r['text'].strip()
            if not t:
                continue
            r['page'] = pi
            r['is_header'] = r['y'] < HEADER_MAX_Y
            r['is_pagenum'] = bool(PAGENUM_RE.match(t))
            r['cap'] = None
            tcap = t
            if len(t) < 40 and sum(1 for tok in t.split() if len(tok) == 1) >= 5:
                tcap = re.sub(r'(?<=\S) (?=\S)', '', t)   # "C a p í t u l o 1 9" -> "Capítulo19"
            m = CAP_RE.search(tcap)
            if m and len(tcap) < 30 and re.match(r'^\s*(c\s*a\s*p|salmo)', tcap, re.I):
                r['cap'] = norm_int(m.group(1))
            r['caps'] = caps_ratio(t) >= 0.8
            r['big'] = r['size'] >= big_min
            r['small'] = r['size'] <= small_max
            if r['big'] and not r['is_header']:
                seen_big_on_page = True
            if (not r['caps']) and FN_LABEL_RE.match(t) and not r['is_header'] and (seen_big_on_page or r['y'] > 120):
                if (not r['big']) or re.match(r'^\s*[(\[]\s*[\d*]{1,3}\s*[)\]jJ}]\s*[A-ZÀ-Ý][A-ZÀ-Ý.,\'’ -]{3,}[—\-–]', t):
                    in_fn = True
            r['in_fn'] = in_fn
            out.append(r)
    return out


def join_hyphen(a, b, lex):
    """Join line-ending hyphenation: a ends with '-' or soft hyphen."""
    a2 = a.rstrip()
    a2 = a2[:-1]
    m1 = re.search(r'([A-Za-zÀ-ÿ]+)$', a2)
    m2 = re.match(r'([A-Za-zÀ-ÿ]+)', b.lstrip())
    if not m1 or not m2:
        return a2 + b.lstrip()
    w1, w2 = m1.group(1), m2.group(1)
    joined = w1 + w2
    hy = w1 + '-' + w2
    if lex.known(joined):
        return a2 + b.lstrip()
    if lex.known(hy) or (lex.known(w1) and lex.known(w2) and len(w1) > 2 and len(w2) > 2 and w1.lower() in ('bem', 'mal', 'primeiro', 'recem', 'recém', 'vice', 'meio')):
        return a2 + '-' + b.lstrip()
    return a2 + b.lstrip()


def clean_text(t):
    t = t.replace('­', '-')
    t = INLINE_FN_RE.sub(' ', t)
    t = re.sub(r'\(\s*\*\s*\)', ' ', t)
    t = t.replace('*', ' ')
    t = re.sub(r'[■•·¬_~^`´¨]+', ' ', t)
    t = re.sub(r"\bE[’']\s", 'É ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'\s+([,.;:!?)\]])', r'\1', t)
    t = re.sub(r'([(\[])\s+', r'\1', t)
    t = re.sub(r'\s*:\s*-\s*', ': ', t)
    t = re.sub(r'\.\s*\.\s*\.', '...', t)
    t = re.sub(r'(?<=[.,;:!?])\s*\d\s*$', '', t)   # stray footnote digit at end
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def summary_case(t, lex):
    """Convert an ALL-CAPS chapter summary to sentence case, keeping proper nouns."""
    t = clean_text(t)
    words = t.split(' ')
    out = []
    start = True
    for w in words:
        core = re.sub(r'[^A-Za-zÀ-ÿ]', '', w)
        low = w.lower()
        cap = low[:1].upper() + low[1:]
        if start:
            out.append(cap)
        elif core and lex.is_proper(core):
            out.append(cap)
        else:
            out.append(low)
        start = w.endswith(('.', '?', '!', ':'))
    return ' '.join(out)


DIGC = r"[0-9lIOoSBZiÍíìïjJTQDGÓóôÔ!|]"

def parse_verse_start(t, exp):
    """Return (verse_number, rest) if line t starts with the expected verse number (OCR tolerant), else (None, t)."""
    accept = (exp, exp + 1, exp + 2)
    cands = []
    m = re.match(r'^(' + DIGC + r'{1,3})(?:\s+|\s*[.:]\s*)(.*)$', t)
    if m:
        cands.append((m.group(1), m.group(2)))
    m = re.match(r'^(\d{1,3})$', t)
    if m:
        cands.append((m.group(1), ''))
    m = re.match(r'^(' + DIGC + r')\s(' + DIGC + r')\s+(.*)$', t)
    if m:
        cands.append((m.group(1) + m.group(2), m.group(3)))
    m = re.match(r'^(\d{1,3})([A-Za-zÀ-ÿ].*)$', t)
    if m:
        cands.append((m.group(1), m.group(2)))
    m = re.match(r'^\d\s+(' + DIGC + r'{1,3})\s+(.*)$', t)   # stray footnote digit before the verse number: "1 40 Kebon"
    if m:
        cands.append((m.group(1), m.group(2)))
    for tok, rest in cands:
        n = norm_int(tok)
        if n is None or n not in accept:
            continue
        rest_ = re.sub(r'^[^0-9A-Za-zÀ-ÿ"“«(\[]+', '', rest)
        if rest_ == '' or re.match(r'^[A-Za-zÀ-ÿ"“«(\[]', rest_):
            # avoid treating a leading number that is part of the text (e.g. "12 tribos") when tok is pure digits
            # and exp is far -- already constrained by accept
            return n, rest_
    return None, t


def extract_chapter(pdf_path, chapter, lex, expected_count=None, pages=None):
    rows = doc_rows(pdf_path, pages)
    warnings = []
    # locate start
    start = None
    for i, r in enumerate(rows):
        if r['cap'] == chapter:
            start = i
            break
    if start is None:
        # fallback 1: a "capítulo"-like line (garbled number) before the first big verse-1 line
        first_v1 = None
        for i, r in enumerate(rows):
            if r['big'] and re.match(r'^\s*[·•.\'\-–—_~:;,]*\s*[1lI!|]\s+\S', r['text']) and not r['in_fn']:
                first_v1 = i
                break
        if first_v1 is not None:
            for i in range(first_v1 - 1, max(-1, first_v1 - 12), -1):
                if CAPWORD_RE.match(rows[i]['text']) and len(rows[i]['text'].strip()) < 30:
                    start = i
                    warnings.append('cap-garbled')
                    break
            if start is None:
                start = first_v1
                warnings.append('start-by-verse1')
    if start is None:
        return {'ok': False, 'warnings': ['no-start'], 'verses': {}, 'title': ''}
    # locate end: next CAP line after start
    end = len(rows)
    for i in range(start + 1, len(rows)):
        r_ = rows[i]
        if r_['cap'] is not None and not r_['in_fn'] and r_['cap'] != chapter and (r_['cap'] == chapter + 1 or (r_['caps'] and r_['cap'] > chapter)):
            end = i
            break
    seg = rows[start:end]
    # summary: small CAPS lines after the cap line, before first big line
    title_parts = []
    body = []
    seen_big = False
    for r in (seg[1:] if (rows[start]['cap'] is not None or 'cap-garbled' in warnings) else seg):
        t = r['text'].strip()
        if r['is_header'] or r['is_pagenum']:
            continue
        if not seen_big and (r['caps'] or not r['big']) and not r['in_fn']:
            if r['caps']:
                title_parts.append(t)
            continue
        if r['big'] and not r['in_fn']:
            if r['caps'] and len(t) < 40 and not re.match(r'^\s*\d', t):
                continue  # stray title fragment
            seen_big = True
            body.append((t, r['x'], r['page']))
    # hyphenation & verse split
    lines = body
    # left margin per page (continuation lines); verse starts are indented ~15-20pt
    margin = {}
    for t, x, pg in body:
        margin.setdefault(pg, []).append(x)
    margin = {pg: (sorted(xs)[max(0, int(len(xs) * 0.2) - 1)] if len(xs) >= 3 else min(xs)) for pg, xs in margin.items()}
    # merge lines into verse buffers
    verses = {}
    order = []
    exp = 1
    cur = None
    buf = ''
    pending_num = None
    heading = None

    def flush():
        nonlocal buf, cur
        if cur is not None:
            verses[cur] = clean_text(buf)
        buf = ''

    for t, x, pg in lines:
        t = re.sub(r'^[^0-9A-Za-zÀ-ÿ"“«(\[]+', '', t)
        num, rest = parse_verse_start(t, exp)
        indented = (x - margin.get(pg, x)) >= 10
        if num is None and indented and cur is not None and (expected_count is None or exp <= expected_count):
            # verse number lost by the OCR: an indented line starts the next verse
            m2 = re.match(r'^(\S{1,2})\s+(.*)$', t)
            tok = m2.group(1) if m2 else ''
            if m2 and not lex.known(tok) and not tok.isalpha() and re.search(r'[A-Za-z0-9]', tok) and not re.search(r'["“”«»\'‘’]', tok) and len(m2.group(2)) > 3:
                rest = m2.group(2)   # e.g. "-f Esta ..." where "-f" is a misread "4"
            else:
                rest = None
            if rest is not None:
                rest = rest[:1].upper() + rest[1:]
                num = exp
                warnings.append(f'indent:{exp}')
        if num is not None:
            if num != exp:
                warnings.append(f'skip:{exp}->{num}')
            flush()
            cur = num
            exp = num + 1
            buf = rest
            continue
        # continuation line
        if cur is None:
            # text before verse 1: psalm heading / preface (e.g. Baruc 6 intro)
            heading = ((heading or '') + ' ' + t).strip()
            continue
        if buf.rstrip().endswith(('-', '­')):
            buf = join_hyphen(buf, t, lex)
        else:
            buf = buf.rstrip() + ' ' + t.lstrip()
    flush()
    if heading and 1 not in verses and 2 in verses and len(heading.split()) >= 3:
        verses[1] = clean_text(heading)   # verse 1 whose number the OCR lost
        heading = None
        warnings.append('heading->v1')
    tj = ''
    for tp in title_parts:
        if tj.rstrip().endswith(('-', '\u00ad')):
            tj = join_hyphen(tj, tp, lex)
        else:
            tj = (tj + ' ' + tp).strip()
    title = summary_case(tj, lex) if title_parts else ''
    if title:
        ws = re.findall(r'[A-Za-zÀ-ÿ]+', title)
        kn = sum(1 for w in ws if lex.known(w) or lex.known(w.lower()))
        if not ws or kn / len(ws) < 0.6 or len(ws) < 3:
            warnings.append('title-dropped')
            title = ''
    if heading:
        heading = clean_text(heading)
    ok = True
    if expected_count is not None:
        n = len(verses)
        if n != expected_count:
            warnings.append(f'count:{n}/{expected_count}')
            ok = False
    return {'ok': ok, 'title': title, 'verses': verses, 'heading': heading, 'warnings': warnings}


class Lexicon:
    def __init__(self, uni, freq, spell=None):
        self.uni = uni
        self.freq = freq
        self.spell = spell
        self.cache = {}
        self.lower_uni = {}
        for w, c in uni.items():
            self.lower_uni[w.lower()] = self.lower_uni.get(w.lower(), 0) + c

    def known(self, w):
        if not w:
            return False
        if w in self.cache:
            return self.cache[w]
        r = False
        if w in self.uni or w.lower() in self.lower_uni:
            r = True
        elif w.lower() in self.freq and self.freq[w.lower()] >= 5:
            r = True
        elif self.spell is not None:
            try:
                r = bool(self.spell.lookup(w)) or bool(self.spell.lookup(w.lower()))
            except Exception:
                r = False
        self.cache[w] = r
        return r

    def is_proper(self, core):
        cap = core[:1].upper() + core[1:].lower()
        low = core.lower()
        return self.uni.get(cap, 0) > self.uni.get(low, 0) and self.uni.get(cap, 0) > 0


if __name__ == '__main__':
    import sys, pickle, json
    lx = pickle.load(open('lex.pkl', 'rb'))
    lex = Lexicon(lx['uni'], lx['freq'])
    pdf, ch = sys.argv[1], int(sys.argv[2])
    r = extract_chapter(pdf, ch, lex)
    print(json.dumps(r, ensure_ascii=False, indent=1)[:6000])
