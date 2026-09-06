#!/usr/bin/env python3
import json,pickle,collections,os,sys
from multiprocessing import Pool
from ocr_extract import extract_chapter, Lexicon
lx=pickle.load(open('lex.pkl','rb')); lex=Lexicon(lx['uni'],lx['freq'])
vul=json.load(open('VULG.json'))
books={b['slug']:b for b in json.load(open('books.json'))}
vc=collections.defaultdict(dict)
for v in vul: vc[v['book']][v['chapter']]=max(vc[v['book']].get(v['chapter'],0),v['verse'])
jobs=[]
for line in open('missing_chapters.txt'):
    slug,c=line.split(); c=int(c)
    pdf=f'bt_pdfs/{slug}__{c}.pdf'
    if os.path.exists(pdf): jobs.append((slug,c,pdf))
def work(j):
    slug,c,pdf=j
    try:
        r=extract_chapter(pdf,c,lex,expected_count=vc[books[slug]['bolls']].get(c))
    except Exception as e:
        r={'ok':False,'verses':{},'title':'','warnings':[f'exc:{e}']}
    r['expected']=vc[books[slug]['bolls']].get(c)
    return (slug,c,r)
if __name__=='__main__':
    with Pool(4) as p:
        out=p.map(work,jobs,chunksize=4)
    os.makedirs('ocr_parsed',exist_ok=True)
    byb=collections.defaultdict(dict)
    for slug,c,r in out: byb[slug][c]=r
    for slug,chs in byb.items():
        json.dump({str(k):v for k,v in sorted(chs.items())},open(f'ocr_parsed/{slug}.json','w'),ensure_ascii=False)
    ok=sum(1 for _,_,r in out if r['ok']); print('chapters',len(out),'ok',ok)
    bad=[(s,c,len(r['verses']),r['expected'],r['warnings'][:3]) for s,c,r in out if not r['ok']]
    for b in bad: print(b)
