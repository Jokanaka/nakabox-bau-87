#!/usr/bin/env python3
"""Extract every non-transcribed chapter from the 1950 edition volumes using vol_ranges.json -> ocr_vol/<slug>.json"""
import json, pickle, collections, os
from multiprocessing import Pool
import pymupdf
from ocr_extract import extract_chapter, Lexicon

lx = pickle.load(open('lex.pkl', 'rb')); lex = Lexicon(lx['uni'], lx['freq'])
books = json.load(open('books.json'))
byid = {b['id']: b for b in books}
byslug = {b['slug']: b for b in books}
vul = json.load(open('VULG.json'))
vc = collections.defaultdict(dict)
for v in vul: vc[v['book']][v['chapter']] = max(vc[v['book']].get(v['chapter'], 0), v['verse'])
ranges = json.load(open('vol_ranges.json'))
need = []
for line in open('missing_chapters.txt'):
    slug, c = line.split(); c = int(c)
    need.append((byslug[slug]['id'], c))
# group by volume
byvol = collections.defaultdict(list)
for bid, c in need:
    rs = ranges.get(f'{bid}.{c}')
    if not rs:
        continue
    # choose the widest range; if two volumes, take the one with more pages
    r = max(rs, key=lambda x: x[2] - x[1])
    byvol[r[0]].append((bid, c, r[1], r[2]))

def work(vol):
    doc = pymupdf.open(f'vols/vol{vol}.pdf')
    out = []
    for bid, c, lo, hi in byvol[vol]:
        pages = list(range(max(0, lo), min(len(doc) - 1, hi + 1) + 1))
        try:
            r = extract_chapter(doc, c, lex, expected_count=vc[byid[bid]['bolls']].get(c), pages=pages)
        except Exception as e:
            r = {'ok': False, 'verses': {}, 'title': '', 'warnings': [f'exc:{e}']}
        r['expected'] = vc[byid[bid]['bolls']].get(c)
        r['pages'] = [vol, lo, hi]
        out.append((bid, c, r))
    return out

if __name__ == '__main__':
    vols = sorted(byvol)
    with Pool(4) as p:
        res = p.map(work, vols)
    os.makedirs('ocr_vol', exist_ok=True)
    byb = collections.defaultdict(dict)
    allr = [x for chunk in res for x in chunk]
    for bid, c, r in allr: byb[byid[bid]['slug']][c] = r
    for slug, chs in byb.items():
        json.dump({str(k): v for k, v in sorted(chs.items())}, open(f'ocr_vol/{slug}.json', 'w'), ensure_ascii=False)
    ok = sum(1 for _, _, r in allr if r['ok'])
    print('chapters', len(allr), 'ok', ok, 'needed', len(need))
    for bid, c, r in allr:
        if not r['ok']:
            print((bid, c, len(r['verses']), r['expected'], r['warnings'][:3], r['pages']))
