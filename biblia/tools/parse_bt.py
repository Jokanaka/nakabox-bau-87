#!/usr/bin/env python3
"""Parse bibliatraduzida.com Figueiredo chapter pages into JSON.
Output: fig_parsed/<slug>.json = {slug, chapters:{n:{title, verses:{v:text}, missing:bool}}}
"""
import os,re,html,json,collections,sys
d='bt_pages'
out={}
def clean(t):
    t=html.unescape(t)
    t=re.sub(r'\s+',' ',t).strip()
    return t
stats=collections.Counter()
for f in sorted(os.listdir(d)):
    s=open(os.path.join(d,f),encoding='utf-8',errors='ignore').read()
    slug,c=f[:-5].split('__'); c=int(c)
    book=out.setdefault(slug,{'slug':slug,'chapters':{}})
    if 'ainda não foi transcrito' in s or 'class="verse"' not in s:
        book['chapters'][c]={'missing':True}
        stats['missing']+=1
        continue
    m=re.search(r'<div class="summary">(.*?)</div>',s,flags=re.S)
    title=clean(re.sub(r'<[^>]+>','',m.group(1))) if m else ''
    verses={}
    notes={}
    for vm in re.finditer(r'<p class="verse" id="v-(\d+)" data-v="\d+">(.*?)</p>',s,flags=re.S):
        n=int(vm.group(1)); body=vm.group(2)
        body=re.sub(r'<span class="vnum">.*?</span>','',body,flags=re.S)
        # footnotes: <sup class="fnref" ...>[n]<span class="fn-popup" ...>...</span></sup>
        fns=[]
        def grab(mm):
            inner=mm.group(0)
            lab=re.search(r'<span class="fn-label">(.*?)</span>',inner,flags=re.S)
            txt=re.sub(r'<button.*?</button>','',inner,flags=re.S)
            txt=re.sub(r'<span class="fn-label">.*?</span>','',txt,flags=re.S)
            txt=clean(re.sub(r'<[^>]+>','',txt))
            txt=re.sub(r'^\[\d+\]\s*','',txt)
            fns.append(((clean(re.sub(r'<[^>]+>','',lab.group(1))) if lab else ''),txt))
            return ''
        body=re.sub(r'<sup class="fnref".*?</sup>',grab,body,flags=re.S)
        text=clean(re.sub(r'<[^>]+>','',body))
        if n in verses: stats['dupverse']+=1
        verses[n]=text
        if fns: notes[n]=fns
    book['chapters'][c]={'title':title,'verses':verses,'notes':notes}
    stats['ok']+=1
os.makedirs('fig_parsed',exist_ok=True)
for slug,b in out.items():
    json.dump(b,open(f'fig_parsed/{slug}.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
print(stats)
# sanity: verse numbering gaps
gaps=0
for slug,b in out.items():
    for c,ch in b['chapters'].items():
        if ch.get('missing'): continue
        vs=sorted(ch['verses'])
        if vs!=list(range(1,len(vs)+1)):
            gaps+=1
            if gaps<=15: print('gap',slug,c,[v for v in range(1,max(vs)+1) if v not in ch['verses']][:10], 'max',max(vs))
print('chapters with numbering gaps:',gaps)
