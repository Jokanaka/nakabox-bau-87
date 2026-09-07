#!/bin/bash
# Regrava capítulos escolhidos (lista JSON de [livro, capítulo]) com a voz indicada e substitui os arquivos no branch "audio".
# Uso: bash biblia/tools/audio_regen.sh <voz> <lista.json> [parte/partes, ex.: 2/6] [minutos máximos, padrão 55]
# A lista é dividida em partes (item k vai para a parte k mod partes); cada máquina roda uma parte. Retomável.
# Termina com "WORKER_DONE" quando todos os capítulos da parte existem, ou "WORKER_PAUSE" ao esgotar o tempo (rode de novo).
set -u
VOICE="${1:?voz (alex|santa|dora)}"; LIST="${2:?lista json}"; PART="${3:-1/1}"; MAXMIN="${4:-55}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"; APP="$REPO/biblia"
WORK="${AUDIO_WORK:-$HOME/audio-work}"; OUT="$WORK/regen-$VOICE"; MODELS="$WORK/models"; WT="$WORK/audio-branch"
mkdir -p "$OUT" "$MODELS"
log() { echo "$(date -u +%H:%M:%S) $*"; }

# 1) dependências e modelo (uma vez)
python3 -c "import kokoro_onnx, lameenc, numpy" 2>/dev/null || { log "instalando dependências"; pip install -q kokoro-onnx lameenc numpy soundfile 2>&1 | tail -2; }
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ ! -s "$MODELS/$f" ]; then
    log "baixando $f"
    for i in 1 2 3 4; do curl -sSL -m 900 -o "$MODELS/$f.part" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f" && mv "$MODELS/$f.part" "$MODELS/$f" && break || sleep $((5*i)); done
  fi
done
[ -s "$MODELS/kokoro-v1.0.onnx" ] && [ -s "$MODELS/voices-v1.0.bin" ] || { log "modelo não baixado"; exit 1; }

# 2) a minha parte da lista
python3 - "$LIST" "$PART" "$OUT/only.json" <<'PY'
import json, sys
lst = json.load(open(sys.argv[1])); i, n = map(int, sys.argv[2].split('/'))
mine = [x for k, x in enumerate(lst) if k % n == i - 1]
json.dump(mine, open(sys.argv[3], 'w')); print(len(mine), 'capítulos nesta parte')
PY

# 3) branch "audio"
if [ ! -d "$WT/.git" ]; then
  log "clonando o branch audio"
  git clone -q --branch audio --single-branch --depth 1 "$(git -C "$REPO" remote get-url origin)" "$WT" || { log "falha ao clonar o branch audio"; exit 1; }
fi
git -C "$WT" config user.email "$(git -C "$REPO" config user.email || echo bot@example.com)"; git -C "$WT" config user.name "$(git -C "$REPO" config user.name || echo audio-regen)"

# 4) sincronização: substitui no branch os capítulos regravados que ainda diferem, e envia
sync_push() {
  git -C "$WT" pull -q --rebase origin audio 2>/dev/null || { git -C "$WT" rebase --abort 2>/dev/null; git -C "$WT" reset -q --hard origin/audio; }
  local n=0 f b c
  for f in "$OUT/$VOICE"/*/*.json; do
    [ -e "$f" ] || continue
    b="$(basename "$(dirname "$f")")"; c="$(basename "$f" .json)"
    [ -s "$OUT/$VOICE/$b/$c.mp3" ] || continue
    mkdir -p "$WT/$VOICE/$b"
    if ! cmp -s "$OUT/$VOICE/$b/$c.mp3" "$WT/$VOICE/$b/$c.mp3"; then cp "$OUT/$VOICE/$b/$c.mp3" "$OUT/$VOICE/$b/$c.json" "$WT/$VOICE/$b/"; n=$((n+1)); fi
  done
  if [ "$n" -gt 0 ]; then git -C "$WT" add -A "$VOICE" >/dev/null 2>&1; git -C "$WT" commit -qm "Narração ($VOICE): regravados $n capítulos com a apresentação corrigida" || true; fi
  if git -C "$WT" status -sb 2>/dev/null | head -1 | grep -q ahead; then
    for i in 1 2 3 4 5; do
      git -C "$WT" push -q origin audio && { log "enviados (substituídos) $n capítulos"; return 0; }
      git -C "$WT" pull -q --rebase origin audio 2>/dev/null || { git -C "$WT" rebase --abort 2>/dev/null; git -C "$WT" reset -q --hard origin/audio; }
      sleep $((5*i))
    done
    log "falha ao enviar (tento no próximo ciclo)"
  fi
}

# 5) geração só dos capítulos da lista, com sincronização a cada 10 min
cd "$MODELS"
GEN_APP="$APP" GEN_OUT="$OUT" GEN_MODELS="$MODELS" GEN_ONLY="$OUT/only.json" GEN_VOICE="$VOICE" timeout "$((MAXMIN*60))" python3 "$APP/tools/gen_audio.py" >> "$WORK/regen.out" 2>&1 &
GEN=$!
while kill -0 "$GEN" 2>/dev/null; do
  sleep 600 & wait $! 2>/dev/null
  kill -0 "$GEN" 2>/dev/null && sync_push
done
wait "$GEN"; RC=$?
sync_push
tail -1 "$OUT/audio_gen.log" 2>/dev/null
if grep -q "ALL_DONE" "$OUT/audio_gen.log" 2>/dev/null && [ "$RC" -eq 0 ]; then log "WORKER_DONE"; else log "WORKER_PAUSE (rc=$RC)"; fi
