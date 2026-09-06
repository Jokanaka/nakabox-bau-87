#!/usr/bin/env python3
import json,os,re,pickle,sys,collections
from ocr_extract import extract_chapter, Lexicon
import importlib
Fixer=importlib.import_module(os.environ.get('FIXMOD','ocr_fix')).Fixer
lx=pickle.load(open('lex.pkl','rb')); lex=Lexicon(lx['uni'],lx['freq'])
try:
    from spylls.hunspell import Dictionary
    fixer=Fixer(lex,lx['bi'],spell=Dictionary.from_files('pt_BR'))
except TypeError:
    fixer=Fixer(lex,lx['bi'])
USEFIX=True
vul=json.load(open('VULG.json'))
books={b['slug']:b for b in json.load(open('books.json'))}
vc=collections.defaultdict(dict)
for v in vul: vc[v['book']][v['chapter']]=max(vc[v['book']].get(v['chapter'],0),v['verse'])
def toks(t): return re.findall(r"[A-Za-zÀ-ÿ]+|\d+|[^\sA-Za-zÀ-ÿ\d]", t)
def wer(ref,hyp):
    r=toks(ref); h=toks(hyp)
    # word-level Levenshtein

    D=[[0]*(len(h)+1) for _ in range(len(r)+1)]
    for i in range(len(r)+1): D[i][0]=i
    for j in range(len(h)+1): D[0][j]=j
    for i in range(1,len(r)+1):
        for j in range(1,len(h)+1):
            D[i][j]=min(D[i-1][j]+1,D[i][j-1]+1,D[i-1][j-1]+(0 if r[i-1]==h[j-1] else 1))
    return D[len(r)][len(h)], len(r)
tot_err=0; tot_ref=0
show=sys.argv[1:] 
for line in open('val_list.txt'):
    slug,c=line.split(); c=int(c)
    pdf=f'val_pdfs/{slug}__{c}.pdf'
    if not os.path.exists(pdf): continue
    exp=vc[books[slug]['bolls']][c]
    r=extract_chapter(pdf,c,lex,expected_count=exp)
    ref=json.load(open(f'fig_parsed/{slug}.json'))['chapters'][str(c)]
    errs=0; n=0
    for v,t in ref['verses'].items():
        v=int(v)
        if v==0: continue
        hyp=r['verses'].get(v,'')
        if USEFIX and hyp: hyp=fixer.fix_text(hyp)
        e,nr=wer(t,hyp); errs+=e; n+=nr
        if slug in show and e>0:
            print(f'  v{v} ref: {t}\n  v{v} hyp: {hyp}\n')
    tot_err+=errs; tot_ref+=n
    print(f"{slug:14s} {c:3d} verses={len(r['verses']):3d}/{exp:3d} WER={errs/max(n,1)*100:5.1f}%  warn={r['warnings'][:4]}  title={r['title'][:60]!r}")
print(f'TOTAL WER = {tot_err/tot_ref*100:.2f}%  ({tot_err}/{tot_ref})')
