#!/usr/bin/env python3
"""Gera a narração de cada capítulo (vozes Kokoro pt-br) como MP3 + JSON com o tempo de cada versículo. Retomável.
Saída: $GEN_OUT/<voz>/<livro>/<cap>.mp3|json e $GEN_OUT/<voz>/sample.mp3.
Uso: python3 gen_audio.py [voz:livro,voz:livro,...]   (sem argumentos: plano padrão, Alex na Bíblia inteira primeiro)
Variáveis: GEN_APP (pasta biblia), GEN_OUT (saída), GEN_MODELS (pasta com kokoro-v1.0.onnx e voices-v1.0.bin)."""
import json, os, sys, time, re, numpy as np, lameenc
from kokoro_onnx import Kokoro
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.environ.get('GEN_APP') or (os.path.abspath(os.path.join(HERE, '..')) if os.path.exists(os.path.join(HERE, '..', 'data', 'books.json')) else '/home/user/nakabox-bau-87/biblia')
OUT = os.environ.get('GEN_OUT') or os.path.join(HERE, 'audio_out')
MODELS = os.environ.get('GEN_MODELS') or HERE
SR = 24000
GAP_VERSE, GAP_INTRO, GAP_END = 0.35, 0.8, 0.6
VOICES = {'alex': 'pm_alex', 'santa': 'pm_santa', 'dora': 'pf_dora'}
SAMPLE = ('No princípio criou Deus o céu e a terra. E a terra era vazia e vaga, e as trevas cobriam a face do abismo, '
          'e o Espírito de Deus era levado sobre as águas. E disse Deus: Faça-se a luz. E a luz foi feita.')
books = json.load(open(f'{APP}/data/books.json'))
byid = {b['id']: b for b in books}
ids = [b['id'] for b in books]
# ordem padrão: Alex na Bíblia inteira (Novo Testamento, depois Gênesis e Salmos, depois o resto do Antigo Testamento);
# só depois Santa e Dora na mesma ordem
NT = ['mt', 'mc', 'lc', 'jo', 'at', 'rm', '1cor', '2cor', 'gl', 'ef', 'fl', 'cl', '1ts', '2ts', '1tm', '2tm', 'tt', 'fm', 'hb', 'tg', '1pd', '2pd', '1jo', '2jo', '3jo', 'jd', 'ap']
order = NT + ['gn', 'sl'] + [b for b in ids if b not in NT and b not in ('gn', 'sl')]
plan = [(v, b) for v in VOICES for b in order]
if len(sys.argv) > 1: plan = [tuple(x.split(':')) for x in sys.argv[1].split(',')]
for v, b in plan:
    if v not in VOICES or b not in byid: sys.exit(f'plano inválido: {v}:{b}')
os.makedirs(OUT, exist_ok=True)
k = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'))

SPEECH_VERBS = r'(?:disse|dizendo|dizia|disseram|diz|dirá|dir[aá]s|respondeu|responderam|respondendo|perguntou|perguntaram|perguntando|clamou|clamaram|clamando|exclamou|gritou|gritando|falou|falaram|falando|ordenou|ordenando|anunciou|proclamou|jurou|rogou|orou|pediu|chamou|bradou|acrescentou|replicou|declarou|mandou|prometeu|escreveu|cantou|cantaram)'
SPEECH_RE = re.compile(r'^(.{2,}?\b' + SPEECH_VERBS + r'\b[^:]{0,45}?):\s+(["“]?[A-ZÀ-Ú].+)$', re.S | re.I)

def clean_base(t):
    t = re.sub(r'\s+', ' ', t or '').strip()
    t = re.sub(r'\[[^\]]*\]', '', t)
    t = t.replace('“', '"').replace('”', '"').replace('«', '"').replace('»', '"')
    t = re.sub(r'\s+([,.;:!?])', r'\1', t)
    return t.strip()

def finish_sent(t):
    t = t.strip()
    return t if not t or t[-1] in '.!?' else t + '.'

# divide o texto em trechos com ritmo próprio: narração um pouco mais lenta, falas na velocidade normal,
# pausa curta antes de cada fala (como quem conta uma história) e respiro entre frases
def segments(text, base=0.96):
    t = clean_base(text)
    if not t: return []
    sents = [x for x in re.split(r'(?<=[.!?…])\s+(?=["“(]?[A-ZÀ-Ú0-9])', t) if x.strip()]
    out = []
    for s in sents:
        m = SPEECH_RE.match(s)
        if m:
            lead, speech = m.group(1).strip(), m.group(2).strip()
            out.append((lead.rstrip(',.;:') + ',', base, 0.25))
            out.append((finish_sent(speech), 0.97 if speech.endswith('?') else 1.0, 0.12))
        else:
            s2 = re.sub(r'\s*:\s*(?=[A-ZÀ-Ú])', '. ', s)
            out.append((finish_sent(s2), 0.97 if s2.endswith('?') else base, 0.12))
    return out

def synth_one(text, voice, speed):
    text = clean_base(text)
    if not text: return np.zeros(0, dtype=np.float32)
    s, sr = k.create(text, voice=VOICES[voice], speed=speed, lang='pt-br')
    assert sr == SR
    return s.astype(np.float32)

def synth(text, voice, base=0.96):
    parts = []
    segs = segments(text, base)
    for i, (t, speed, pause) in enumerate(segs):
        a = synth_one(t, voice, speed)
        if not len(a): continue
        parts.append(a)
        if i < len(segs) - 1: parts.append(silence(pause))
    return np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)

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
        intro_audio = np.concatenate([synth_one(head + '.', voice, 0.95), silence(0.5), synth((ch.get('title') or ''), voice, 0.95)]) if ch.get('title') else synth_one(head + '.', voice, 0.95)
        parts = [intro_audio, silence(GAP_INTRO)]
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
