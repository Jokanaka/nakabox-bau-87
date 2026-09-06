#!/usr/bin/env python3
"""Learn OCR confusion pairs by aligning raw OCR verses (validation PDFs) with the clean transcription.
Writes learned_conf.json: {"chars": [[src, dst, count], ...], "words": {ocr_word: ref_word, ...}}"""
import json, os, re, pickle, collections, difflib
from ocr_extract import extract_chapter, Lexicon

lx = pickle.load(open('lex.pkl', 'rb')); lex = Lexicon(lx['uni'], lx['freq'])
vul = json.load(open('VULG.json'))
books = {b['slug']: b for b in json.load(open('books.json'))}
vc = collections.defaultdict(dict)
for v in vul: vc[v['book']][v['chapter']] = max(vc[v['book']].get(v['chapter'], 0), v['verse'])
TOK = re.compile(r"[A-Za-zÀ-ÿ]+")

chars = collections.Counter()
words = collections.Counter()
pairs_seen = 0
for line in open('val_list.txt'):
    slug, c = line.split(); c = int(c)
    pdf = f'val_pdfs/{slug}__{c}.pdf'
    if not os.path.exists(pdf): continue
    r = extract_chapter(pdf, c, lex, expected_count=vc[books[slug]['bolls']][c])
    ref = json.load(open(f'fig_parsed/{slug}.json'))['chapters'][str(c)]
    for v, t in ref['verses'].items():
        v = int(v)
        if v == 0: continue
        hyp = r['verses'].get(v, '')
        a = TOK.findall(hyp); b = TOK.findall(t)
        sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag != 'replace' or (i2 - i1) != (j2 - j1): continue
            for x, y in zip(a[i1:i2], b[j1:j2]):
                if x == y or abs(len(x) - len(y)) > 3: continue
                pairs_seen += 1
                words[(x, y)] += 1
                # char-level diff
                cm = difflib.SequenceMatcher(None, x, y, autojunk=False)
                for t2, p1, p2, q1, q2 in cm.get_opcodes():
                    if t2 == 'equal': continue
                    src, dst = x[p1:p2], y[q1:q2]
                    if len(src) <= 3 and len(dst) <= 3 and (src or dst):
                        chars[(src, dst)] += 1
print('word pairs', pairs_seen, 'distinct', len(words), 'char confusions', len(chars))
top_chars = [[s, d, n] for (s, d), n in chars.most_common() if n >= 3 and s and d]
top_words = {x: y for (x, y), n in words.items() if n >= 2 and lex.known(y) and not lex.known(x) and not x.isupper()}
real_words = {x: y for (x, y), n in words.items() if n >= 2 and lex.known(y) and lex.known(x) and x.lower() != y.lower().replace('ê', 'e').replace('ô', 'o') and len(x) > 2}
print('chars kept', len(top_chars), top_chars[:40])
print('words kept', len(top_words), list(top_words.items())[:30])
print('real-word pairs', real_words)
json.dump({'chars': top_chars, 'words': top_words, 'real': real_words}, open('learned_conf.json', 'w'), ensure_ascii=False, indent=0)
