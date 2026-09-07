#!/bin/bash
# Publica a narração: traz o que outros trabalhadores já enviaram ao branch audio, copia os capítulos locais novos,
# envia, e escreve biblia/data/audio.json com a cobertura (capítulos contíguos por voz e livro) lida do próprio branch.
set -e
SP=${AUDIO_SP:-$HOME/audio-publish}
OUT=${AUDIO_OUT:-$SP/audio_out}; WT=${AUDIO_WT:-$HOME/nakabox-bau-87-audio}; APP=${AUDIO_APP:-$(cd "$(dirname "$0")/.." && pwd)}
cd $WT && git checkout -q audio && (git pull -q --rebase origin audio 2>/dev/null || true)
python3 - "$OUT" "$WT" <<'PY'
import json, os, shutil, sys
out, wt = sys.argv[1], sys.argv[2]
books = json.load(open('/home/user/nakabox-bau-87/biblia/data/books.json'))
NAMES = {'alex': ('Alex', 'masculina'), 'santa': ('Santa', 'masculina, mais grave'), 'dora': ('Dora', 'feminina')}
# 1) copia os capítulos locais que ainda não estão no branch
n_new = 0
for vid in sorted(os.listdir(out)):
    vdir = os.path.join(out, vid)
    if not os.path.isdir(vdir) or vid not in NAMES: continue
    os.makedirs(f"{wt}/{vid}", exist_ok=True)
    if os.path.exists(f"{vdir}/sample.mp3") and not os.path.exists(f"{wt}/{vid}/sample.mp3"): shutil.copyfile(f"{vdir}/sample.mp3", f"{wt}/{vid}/sample.mp3")
    for b in books:
        d = os.path.join(vdir, b['id'])
        if not os.path.isdir(d): continue
        for c in range(1, b['chapters'] + 1):
            if not (os.path.exists(f"{d}/{c}.json") and os.path.exists(f"{d}/{c}.mp3")): continue
            if os.path.exists(f"{wt}/{vid}/{b['id']}/{c}.json"): continue
            os.makedirs(f"{wt}/{vid}/{b['id']}", exist_ok=True)
            for ext in ('mp3', 'json'): shutil.copyfile(f"{d}/{c}.{ext}", f"{wt}/{vid}/{b['id']}/{c}.{ext}")
            n_new += 1
# 2) cobertura a partir do branch (o que qualquer trabalhador enviou)
voices = {}
for vid in NAMES:
    if not os.path.isdir(f"{wt}/{vid}"): continue
    done = {}
    for b in books:
        d = f"{wt}/{vid}/{b['id']}"
        n = 0
        while os.path.exists(f"{d}/{n+1}.json") and os.path.exists(f"{d}/{n+1}.mp3"): n += 1
        if n: done[b['id']] = n
    voices[vid] = {'name': NAMES[vid][0], 'desc': NAMES[vid][1], 'books': done}
json.dump(voices, open(f"{wt}/index.json", 'w'), ensure_ascii=False)
print('novos:', n_new, 'vozes:', {k: sum(v['books'].values()) for k, v in voices.items()})
PY
git add -A
if git diff --cached --quiet; then echo "nada novo"; else git commit -qm "Narração: $(python3 -c "import json;d=json.load(open('$WT/index.json'));print('; '.join(k+': '+', '.join(f'{b} {n}' for b,n in v['books'].items()) for k,v in d.items()))")"; fi
for i in 1 2 3 4 5; do (git pull -q --rebase origin audio 2>/dev/null || true); git push -q -u origin audio && break || sleep $((2**i)); done
SHA=$(git rev-parse HEAD)
python3 - "$WT" "$SHA" "$APP" <<'PY'
import json, sys
wt, sha, app = sys.argv[1], sys.argv[2], sys.argv[3]
voices = json.load(open(f'{wt}/index.json'))
m = {"base": f"https://cdn.jsdelivr.net/gh/jokanaka/nakabox-bau-87@{sha}/", "fallback": f"https://raw.githubusercontent.com/jokanaka/nakabox-bau-87/{sha}/", "voices": voices}
json.dump(m, open(f'{app}/data/audio.json', 'w'), ensure_ascii=False)
print('manifesto:', {k: sum(v['books'].values()) for k, v in voices.items()}, 'sha', sha[:10])
PY
