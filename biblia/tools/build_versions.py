#!/usr/bin/env python3
"""Build Vulgata Clementina (bolls VULG) and Douay-Rheims (bibliatraduzida + bolls DRB) JSON files.
Output: out/data/<version>/<bookid>.json  {"id","name","chapters":[{"n":1,"verses":["..",..]}]}
"""
import json, os, collections, re, html

books = json.load(open('books.json'))
OUT = 'out/data'


def write_book(version, b, chapters, extra=None):
    os.makedirs(f'{OUT}/{version}', exist_ok=True)
    doc = {'id': b['id'], 'name': b['name'], 'chapters': chapters}
    if extra:
        doc.update(extra)
    json.dump(doc, open(f'{OUT}/{version}/{b["id"]}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


def from_bolls(path, version, name_key, only=None):
    data = json.load(open(path))
    by = collections.defaultdict(lambda: collections.defaultdict(dict))
    for v in data:
        by[v['book']][v['chapter']][v['verse']] = re.sub(r'<[^>]+>', '', html.unescape(v['text'])).strip()
    stats = {}
    for b in books:
        if only and b['id'] not in only:
            continue
        chs = by.get(b['bolls'])
        if not chs:
            stats[b['id']] = 'MISSING'
            continue
        chapters = []
        for c in sorted(chs):
            vs = chs[c]
            mx = max(vs)
            arr = [vs.get(i, '') for i in range(1, mx + 1)]
            chapters.append({'n': c, 'verses': arr})
        write_book(version, dict(b, name=b[name_key]), chapters)
        stats[b['id']] = len(chapters)
    return stats


def from_site_drb():
    stats = {}
    bad = {'1-samuel', '2-samuel', 'lucas'}
    for b in books:
        if b['slug'] in bad:
            continue
        d = json.load(open(f'drb_parsed/{b["slug"]}.json'))
        chapters = []
        for c in sorted(int(k) for k in d['chapters']):
            ch = d['chapters'][str(c)]
            if ch.get('missing'):
                continue
            vs = {int(k): v for k, v in ch['verses'].items()}
            heading = vs.pop(0, None)
            mx = max(vs) if vs else 0
            arr = [vs.get(i, '') for i in range(1, mx + 1)]
            entry = {'n': c, 'verses': arr}
            if heading:
                entry['heading'] = heading
            if ch.get('title'):
                entry['title'] = ch['title']
            chapters.append(entry)
        write_book('drb', dict(b, name=b['en']), chapters)
        stats[b['id']] = len(chapters)
    return stats


if __name__ == '__main__':
    s1 = from_bolls('VULG.json', 'vulgata', 'la')
    print('vulgata', {k: v for k, v in s1.items() if v == 'MISSING'} or 'ok', len(s1))
    s2 = from_site_drb()
    s3 = from_bolls('DRB.json', 'drb', 'en', only={'1sm', '2sm', 'lc'})
    print('drb site', len(s2), 'bolls', s3)
