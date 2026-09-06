#!/usr/bin/env python3
"""Gera a narração de cada capítulo (vozes Kokoro pt-br) como MP3 + JSON com o tempo de cada versículo. Retomável.
Saída: audio_out/<voz>/<livro>/<cap>.mp3|json e audio_out/<voz>/sample.mp3."""
import json, os, sys, time, re, numpy as np, lameenc
from kokoro_onnx import Kokoro
APP = '/home/user/nakabox-bau-87/biblia'
OUT = '/tmp/claude-0/-home-user-nakabox-bau-87/972f22bb-545c-5ad0-ac6c-c883efe8c07c/scratchpad/audio_out'
SR = 24000
GAP_VERSE, GAP_INTRO, GAP_END = 0.35, 0.8, 0.6
VOICES = {'alex': 'pm_alex', 'santa': 'pm_santa', 'dora': 'pf_dora'}
SAMPLE = ('No princípio criou Deus o céu e a terra. E a terra era vazia e vaga, e as trevas cobriam a face do abismo, '
          'e o Espírito de Deus era levado sobre as águas. E disse Deus: Faça-se a luz. E a luz foi feita.')
books = json.load(open(f'{APP}/data/books.json'))
byid = {b['id']: b for b in books}
ids = [b['id'] for b in books]
# ordem: Mateus nas três vozes, depois os outros Evangelhos, Atos e Salmos (cada livro nas três vozes),
# depois o resto da Bíblia primeiro em Alex, depois Santa, depois Dora
plan = [(v, 'mt') for v in VOICES]
for b in ['mc', 'lc', 'jo', 'at', 'sl']: plan += [(v, b) for v in VOICES]
rest = [b for b in ids if b not in ('mt', 'mc', 'lc', 'jo', 'at', 'sl')]
for v in VOICES: plan += [(v, b) for b in rest]
if len(sys.argv) > 1: plan = [tuple(x.split(':')) for x in sys.argv[1].split(',')]
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')

def clean(t):
    t = re.sub(r'\s+', ' ', t or '').strip()
    t = re.sub(r'\[[^\]]*\]', '', t)
    t = t.replace('“', '"').replace('”', '"').replace('«', '"').replace('»', '"')
    t = re.sub(r'\s*:\s*(?=[A-ZÀ-Ú])', '. ', t)
    t = re.sub(r'(?<=[a-zà-ÿ])\.(?=[A-ZÀ-Ú][a-zà-ÿ])', '. ', t)
    t = re.sub(r'\s+([,.;:!?])', r'\1', t)
    if t and t[-1] not in '.!?': t += '.'
    return t

def synth(text, voice):
    text = clean(text)
    if not text: return np.zeros(0, dtype=np.float32)
    s, sr = k.create(text, voice=VOICES[voice], speed=1.0, lang='pt-br')
    assert sr == SR
    return s.astype(np.float32)

def silence(sec): return np.zeros(int(sec * SR), dtype=np.float32)

def encode(samples):
    enc = lameenc.Encoder(); enc.set_bit_rate(48); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes()
    return enc.encode(pcm) + enc.flush()

os.makedirs(OUT, exist_ok=True)
log = open(f'{OUT}/audio_gen.log', 'a')
for v in VOICES:
    os.makedirs(f'{OUT}/{v}', exist_ok=True)
    if not os.path.exists(f'{OUT}/{v}/sample.mp3'):
        open(f'{OUT}/{v}/sample.mp3', 'wb').write(encode(synth(SAMPLE, v)))
        log.write(f"{time.strftime('%H:%M:%S')} sample [{v}]\n"); log.flush()
for voice, bid in plan:
    b = byid[bid]
    data = json.load(open(f'{APP}/data/figueiredo/{bid}.json'))
    os.makedirs(f'{OUT}/{voice}/{bid}', exist_ok=True)
    for ch in data['chapters']:
        n = ch['n']
        if os.path.exists(f'{OUT}/{voice}/{bid}/{n}.json'): continue
        t0 = time.time()
        head = f"Salmo {n}" if bid == 'sl' else f"{b['name']}, capítulo {n}"
        intro = f"{head}. {ch.get('title') or ''}".strip()
        parts = [synth(intro, voice), silence(GAP_INTRO)]
        marks = {'intro': [0.0, round(len(parts[0]) / SR, 2)], 'v': []}
        pos = sum(len(p) for p in parts) / SR
        for i, t in enumerate(ch['verses']):
            vn = i + 1
            if not t: continue
            a = synth(t, voice)
            if not len(a): continue
            parts.append(a); marks['v'].append([vn, round(pos, 2), round(pos + len(a) / SR, 2)])
            pos += len(a) / SR
            parts.append(silence(GAP_VERSE)); pos += GAP_VERSE
        parts.append(silence(GAP_END))
        audio = np.concatenate(parts)
        marks['dur'] = round(len(audio) / SR, 2); marks['voice'] = voice
        open(f'{OUT}/{voice}/{bid}/{n}.mp3', 'wb').write(encode(audio))
        json.dump(marks, open(f'{OUT}/{voice}/{bid}/{n}.json', 'w'), separators=(',', ':'))
        dt = time.time() - t0
        log.write(f"{time.strftime('%H:%M:%S')} {bid} {n} [{voice}] {marks['dur']:.0f}s audio {dt:.0f}s ({dt/max(marks['dur'],1):.2f}x)\n"); log.flush()
log.write('ALL_DONE\n'); log.flush()
