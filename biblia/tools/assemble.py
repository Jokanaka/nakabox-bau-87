#!/usr/bin/env python3
"""Assemble the Figueiredo text: transcription (fig_parsed) + OCR (ocr_parsed, ocr_1sm) -> out/data/figueiredo/<id>.json
Applies OCR correction (Fixer) to OCR chapters, conservative fixes to transcribed chapters, and orthography modernisation to all.
Also writes out/data/books.json (catalogue with chapter counts) and a quality report.
"""
import json, os, re, pickle, collections, sys
from ocr_extract import Lexicon
from ocr_fix import Fixer, char_cleanup
from modernize import Modernizer

books = json.load(open('books.json'))
lx = pickle.load(open('lex.pkl', 'rb'))
lex = Lexicon(lx['uni'], lx['freq'])
fixer = Fixer(lex, lx['bi'])
mod = Modernizer()
vul = json.load(open('VULG.json'))
vc = collections.defaultdict(dict)
for v in vul:
    vc[v['book']][v['chapter']] = max(vc[v['book']].get(v['chapter'], 0), v['verse'])

OUT = 'out/data'
os.makedirs(f'{OUT}/figueiredo', exist_ok=True)

WORD = re.compile(r"[A-Za-zÀ-ÿ]+")


def conservative_fix(t):
    """For transcribed text: only accent restoration of unknown words and splitting of glued words."""
    def rep(m):
        w = m.group(0)
        if lex.known(w):
            return w
        r = fixer.fix_word(w)
        # accept only splits or accent-only single edits
        if ' ' in r:
            return r
        if len(r) == len(w) and sum(1 for a, b in zip(r, w) if a != b) == 1:
            return r
        return w
    t = WORD.sub(rep, t)
    t = re.sub(r'\s+([,.;:!?])', r'\1', t)
    return t


def title_case(t):
    words = t.split(' ')
    out = []
    for i, w in enumerate(words):
        core = re.sub(r'[^A-Za-zÀ-ÿ]', '', w)
        if i > 0 and core and core.islower() and len(core) > 2:
            low = core.lower()
            common = lex.freq.get(low, 0) >= 20 or lx['uni'].get(low, 0) >= 2
            if not common:
                w = w.replace(core, core[:1].upper() + core[1:], 1)
        out.append(w)
    return ' '.join(out)


def finish(t):
    t = mod.text(t)
    t = re.sub(r'\s+', ' ', t).strip()
    # capitalise first letter of a verse if it starts with a lowercase letter after a sentence end? keep as is (verses may continue sentences)
    return t


report = []
catalog = []
tot_tr = tot_ocr = 0
for b in books:
    slug = b['slug']
    tr = json.load(open(f'fig_parsed/{slug}.json'))['chapters']
    ocr = {}
    site = json.load(open(f'ocr_parsed/{slug}.json')) if os.path.exists(f'ocr_parsed/{slug}.json') else {}
    volu = json.load(open(f'ocr_vol/{slug}.json')) if os.path.exists(f'ocr_vol/{slug}.json') else {}
    if slug == '1-samuel' and os.path.exists('ocr_1sm.json'):
        volu = json.load(open('ocr_1sm.json'))
    def quality(r, exp):
        # higher is better: exact count best; penalise missing and extra verses
        if not r or not r.get('verses'): return -1e9
        got = len(r['verses']); mx = max(int(k) for k in r['verses'])
        extra = max(0, mx - exp); missing = max(0, exp - got)
        return -(missing * 1.0 + extra * 3.0) - (0 if r.get('ok') else 0.5)
    for c in set(list(site) + list(volu)):
        exp = vc[b['bolls']].get(int(c), 0)
        a, bb = site.get(c), volu.get(c)
        best = max([x for x in (a, bb) if x], key=lambda r: quality(r, exp), default=None)
        if best:
            best = dict(best); best['from'] = 'site' if best is a else 'vol'
            ocr[c] = best
    nch = len(vc[b['bolls']])
    chapters = []
    for c in range(1, nch + 1):
        exp = vc[b['bolls']][c]
        entry = {'n': c}
        t = tr.get(str(c))
        if t and not t.get('missing'):
            vs = {int(k): v for k, v in t['verses'].items()}
            heading = vs.pop(0, None)
            mx = max(max(vs) if vs else 0, exp)
            arr = [finish(conservative_fix(vs.get(i, ''))) for i in range(1, mx + 1)]
            entry['verses'] = arr
            if heading:
                entry['heading'] = finish(conservative_fix(heading))
            if t.get('title'):
                entry['title'] = finish(t['title'])
            entry['src'] = 'tr'
            tot_tr += 1
        else:
            o = ocr.get(str(c))
            if not o or not o.get('verses'):
                entry['verses'] = []
                entry['src'] = 'none'
                report.append((slug, c, 'NO TEXT'))
            else:
                vs = {int(k): v for k, v in o['verses'].items()}
                mx = max(max(vs) if vs else 0, exp)
                arr = []
                for i in range(1, mx + 1):
                    raw = vs.get(i, '')
                    arr.append(finish(fixer.fix_text(raw)) if raw else '')
                entry['verses'] = arr
                if o.get('heading'):
                    entry['heading'] = finish(fixer.fix_text(o['heading']))
                if o.get('title'):
                    entry['title'] = finish(title_case(fixer.fix_text(o['title'])))
                entry['src'] = 'ocr'
                missing = [i for i in range(1, exp + 1) if not arr[i - 1]]
                if missing or len(vs) != exp:
                    entry['warn'] = 1
                    report.append((slug, c, f'verses {len(vs)}/{exp} missing={missing[:6]} {o.get("warnings", [])[:3]}'))
                tot_ocr += 1
        chapters.append(entry)
    doc = {'id': b['id'], 'name': b['name'], 'chapters': chapters}
    json.dump(doc, open(f'{OUT}/figueiredo/{b["id"]}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    catalog.append({k: b[k] for k in ('id', 'slug', 'name', 'abbr', 'test', 'group', 'la', 'en', 'aliases')} | {'deutero': bool(b.get('deutero')), 'chapters': nch, 'verses': [vc[b['bolls']][c] for c in range(1, nch + 1)]})

json.dump(catalog, open(f'{OUT}/books.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('transcribed chapters', tot_tr, 'ocr chapters', tot_ocr, 'problems', len(report))
with open('assemble_report.txt', 'w') as f:
    for r in report:
        f.write(f'{r[0]} {r[1]} {r[2]}\n')
for r in report[:40]:
    print(r)
