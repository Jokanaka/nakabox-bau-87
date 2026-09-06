#!/usr/bin/env python3
"""Gera a narração de cada capítulo (voz Kokoro pt-br) como MP3 + JSON com o tempo de cada versículo. Retomável."""
import json, os, sys, time, re, numpy as np, lameenc
from kokoro_onnx import Kokoro
APP = '/home/user/nakabox-bau-87/biblia'
OUT = '/tmp/claude-0/-home-user-nakabox-bau-87/972f22bb-545c-5ad0-ac6c-c883efe8c07c/scratchpad/audio_out'
VOICE = os.environ.get('VOICE', 'pm_alex'); SPEED = float(os.environ.get('SPEED', '1.0')); SR = 24000
GAP_VERSE, GAP_INTRO, GAP_END = 0.35, 0.8, 0.6
books = json.load(open(f'{APP}/data/books.json'))
byid = {b['id']: b for b in books}
first = ['mt', 'mc', 'lc', 'jo', 'at', 'sl']
order = first + [b['id'] for b in books if b['id'] not in first]
if len(sys.argv) > 1: order = sys.argv[1].split(',')
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')

def clean(t):
    t = re.sub(r'\s+', ' ', t or '').strip()
    t = re.sub(r'\[[^\]]*\]', '', t)                # notas entre colchetes
    t = t.replace('“', '"').replace('”', '"').replace('«', '"').replace('»', '"')
    t = re.sub(r'\s*:\s*(?=[A-ZÀ-Ú])', '. ', t)       # ":" seguido de maiúscula vira pausa de frase (estilo bíblico antigo)
    t = re.sub(r'\s+([,.;:!?])', r'\1', t)
    if t and t[-1] not in '.!?': t += '.'
    return t

def synth(text):
    text = clean(text)
    if not text: return np.zeros(0, dtype=np.float32)
    s, sr = k.create(text, voice=VOICE, speed=SPEED, lang='pt-br')
    assert sr == SR
    return s.astype(np.float32)

def silence(sec): return np.zeros(int(sec * SR), dtype=np.float32)

def encode(samples):
    enc = lameenc.Encoder(); enc.set_bit_rate(48); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes()
    return enc.encode(pcm) + enc.flush()

log = open(f'{OUT}/audio_gen.log', 'a')
os.makedirs(OUT, exist_ok=True)
for bid in order:
    b = byid[bid]
    data = json.load(open(f'{APP}/data/figueiredo/{bid}.json'))
    os.makedirs(f'{OUT}/{bid}', exist_ok=True)
    for ch in data['chapters']:
        n = ch['n']
        if os.path.exists(f'{OUT}/{bid}/{n}.json'): continue
        t0 = time.time()
        head = f"Salmo {n}" if bid == 'sl' else f"{b['name']}, capítulo {n}"
        intro = f"{head}. {ch.get('title') or ''}".strip()
        parts = [synth(intro), silence(GAP_INTRO)]
        marks = {'intro': [0.0, round(len(parts[0]) / SR, 2)], 'v': []}
        pos = sum(len(p) for p in parts) / SR
        for i, t in enumerate(ch['verses']):
            v = i + 1
            if not t: continue
            a = synth(t)
            if not len(a): continue
            parts.append(a); marks['v'].append([v, round(pos, 2), round(pos + len(a) / SR, 2)])
            pos += len(a) / SR
            parts.append(silence(GAP_VERSE)); pos += GAP_VERSE
        parts.append(silence(GAP_END))
        audio = np.concatenate(parts)
        marks['dur'] = round(len(audio) / SR, 2); marks['voice'] = VOICE
        open(f'{OUT}/{bid}/{n}.mp3', 'wb').write(encode(audio))
        json.dump(marks, open(f'{OUT}/{bid}/{n}.json', 'w'), separators=(',', ':'))
        dt = time.time() - t0
        log.write(f"{time.strftime('%H:%M:%S')} {bid} {n} {marks['dur']:.0f}s audio {dt:.0f}s ({dt/max(marks['dur'],1):.2f}x)\n"); log.flush()
log.write('ALL_DONE\n'); log.flush()
