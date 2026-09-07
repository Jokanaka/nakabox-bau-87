#!/bin/bash
# Trabalhador de narração: gera capítulos com a voz indicada e envia os arquivos para o branch "audio" a cada 10 minutos.
# Uso: bash biblia/tools/audio_worker.sh <voz> <livro,livro,...> [minutos máximos, padrão 55] [desc]
# Exemplo: bash biblia/tools/audio_worker.sh alex gn,ex,lv
# "desc" gera os capítulos de cada livro do último para o primeiro: assim outra máquina pode fazer a mesma lista
# na ordem inversa (livros e capítulos) e as duas se encontram no meio sem repetir trabalho.
# Retomável: capítulos já existentes na saída ou já publicados no branch "audio" são pulados (a cada sincronização,
# o que as outras máquinas já enviaram é copiado para a saída local, e o gerador pula esses capítulos).
# Termina com "WORKER_DONE" quando todos os capítulos do plano existem, ou "WORKER_PAUSE" ao esgotar o tempo (rode de novo).
set -u
VOICE="${1:?voz (alex|santa|dora)}"; BOOKS="${2:?livros separados por vírgula}"; MAXMIN="${3:-55}"; ORDER="${4:-asc}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"; APP="$REPO/biblia"
WORK="${AUDIO_WORK:-$HOME/audio-work}"; OUT="$WORK/out"; MODELS="$WORK/models"; WT="$WORK/audio-branch"
mkdir -p "$OUT" "$MODELS"
log() { echo "$(date -u +%H:%M:%S) $*"; }

# 1) dependências (uma vez)
python3 -c "import kokoro_onnx, lameenc, numpy" 2>/dev/null || { log "instalando dependências"; pip install -q kokoro-onnx lameenc numpy soundfile 2>&1 | tail -2; }
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ ! -s "$MODELS/$f" ]; then
    log "baixando $f"
    for i in 1 2 3 4; do curl -sSL -m 900 -o "$MODELS/$f.part" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f" && mv "$MODELS/$f.part" "$MODELS/$f" && break || sleep $((5*i)); done
  fi
done
[ -s "$MODELS/kokoro-v1.0.onnx" ] && [ -s "$MODELS/voices-v1.0.bin" ] || { log "modelo não baixado"; exit 1; }

# 2) branch "audio" (arquivos já publicados contam como prontos)
if [ ! -d "$WT/.git" ]; then
  log "clonando o branch audio"
  git clone -q --branch audio --single-branch --depth 1 "$(git -C "$REPO" remote get-url origin)" "$WT" || { log "falha ao clonar o branch audio"; exit 1; }
fi
git -C "$WT" config user.email "$(git -C "$REPO" config user.email || echo bot@example.com)"; git -C "$WT" config user.name "$(git -C "$REPO" config user.name || echo audio-worker)"
git -C "$WT" pull -q --rebase origin audio 2>/dev/null || true
# copia do branch para a saída local os capítulos já existentes (para o gerador pular)
pull_done() {
  for b in ${BOOKS//,/ }; do
    if [ -d "$WT/$VOICE/$b" ]; then mkdir -p "$OUT/$VOICE/$b"; cp -n "$WT/$VOICE/$b/"* "$OUT/$VOICE/$b/" 2>/dev/null || true; fi
  done
}
pull_done

# 3) sincronização periódica: copia arquivos novos para o branch e envia
sync_push() {
  local n=0
  # primeiro traz o que os outros já enviaram (assim nunca re-adiciona um capítulo que já existe no branch)
  git -C "$WT" pull -q --rebase origin audio 2>/dev/null || { git -C "$WT" rebase --abort 2>/dev/null; git -C "$WT" reset -q --hard origin/audio; }
  pull_done
  for b in ${BOOKS//,/ }; do
    [ -d "$OUT/$VOICE/$b" ] || continue
    mkdir -p "$WT/$VOICE/$b"
    for f in "$OUT/$VOICE/$b"/*.json; do
      [ -e "$f" ] || continue
      local c; c="$(basename "$f" .json)"
      [ -s "$OUT/$VOICE/$b/$c.mp3" ] || continue
      if [ ! -e "$WT/$VOICE/$b/$c.json" ]; then cp "$OUT/$VOICE/$b/$c.mp3" "$OUT/$VOICE/$b/$c.json" "$WT/$VOICE/$b/"; n=$((n+1)); fi
    done
  done
  [ -s "$OUT/$VOICE/sample.mp3" ] && [ ! -e "$WT/$VOICE/sample.mp3" ] && cp "$OUT/$VOICE/sample.mp3" "$WT/$VOICE/"
  if [ "$n" -gt 0 ]; then
    git -C "$WT" add -A "$VOICE" >/dev/null 2>&1
    git -C "$WT" commit -qm "Narração ($VOICE): +$n capítulos ($BOOKS)" || true
    for i in 1 2 3 4 5; do
      git -C "$WT" push -q origin audio && { log "enviados $n capítulos"; return 0; }
      # alguém enviou antes: traz e tenta de novo; num conflito, fica com a versão do branch (o próximo ciclo re-adiciona o que faltar)
      git -C "$WT" pull -q --rebase origin audio 2>/dev/null || { git -C "$WT" rebase --abort 2>/dev/null; git -C "$WT" reset -q --hard origin/audio; }
      sleep $((5*i))
    done
    log "falha ao enviar (tento no próximo ciclo)"
  fi
}

# 4) geração (plano só desta voz e destes livros), com sincronização a cada 10 min
PLAN="$(for b in ${BOOKS//,/ }; do printf '%s:%s,' "$VOICE" "$b"; done)"; PLAN="${PLAN%,}"
cd "$MODELS"
GEN_APP="$APP" GEN_OUT="$OUT" GEN_MODELS="$MODELS" GEN_REVERSE="$([ "$ORDER" = desc ] && echo 1 || echo 0)" timeout "$((MAXMIN*60))" python3 "$APP/tools/gen_audio.py" "$PLAN" >> "$WORK/gen.out" 2>&1 &
GEN=$!
while kill -0 "$GEN" 2>/dev/null; do
  sleep 600 & wait $! 2>/dev/null
  kill -0 "$GEN" 2>/dev/null && sync_push
done
wait "$GEN"; RC=$?
sync_push
tail -1 "$OUT/audio_gen.log" 2>/dev/null
if grep -q "ALL_DONE" "$OUT/audio_gen.log" 2>/dev/null && [ "$RC" -eq 0 ]; then log "WORKER_DONE"; else log "WORKER_PAUSE (rc=$RC)"; fi
