#!/usr/bin/env python3
"""OCR post-correction for Portuguese (1950 orthography) verse text."""
import re, math

# (src, dst) confusion substitutions used to generate candidates for unknown words
CONF = [
    ('c', 'e'), ('e', 'c'), ('cl', 'd'), ('ci', 'd'), ('el', 'd'), ('d', 'cl'),
    ('ii', 'h'), ('h', 'b'), ('b', 'h'), ('í', 'fi'), ('íi', 'fi'), ('í', 'f'), ('f', 'í'), ('oí', 'of'),
    ('l', 'i'), ('i', 'l'), ('í', 'i'), ('i', 'í'), ('l', 't'), ('t', 'l'), ('1', 'l'), ('1', 'i'), ('!', 'l'), ('|', 'l'),
    ('ó', 'ô'), ('ò', 'ô'), ('ô', 'o'), ('õ', 'ô'), ('õ', 'ã'), ('ã', 'â'), ('â', 'ã'), ('ó', 'o'), ('o', 'ó'), ('o', 'ô'), ('o', 'õ'),
    ('rn', 'm'), ('m', 'rn'), ('n', 'u'), ('u', 'n'), ('nn', 'm'), ('m', 'nn'), ('ni', 'm'), ('in', 'm'),
    ('o', 'a'), ('a', 'o'), ('e', 'o'), ('o', 'e'), ('a', 'á'), ('a', 'à'), ('e', 'é'), ('e', 'ê'), ('u', 'ú'), ('ú', 'u'),
    ('c', 'ç'), ('ç', 'c'), ('q', 'g'), ('g', 'q'), ('v', 'y'), ('y', 'v'), ('z', 's'), ('s', 'z'), ('x', 'z'),
    ('ê', 'é'), ('é', 'ê'), ('è', 'ê'), ('È', 'Ê'), ('É', 'Ê'), ('Ê', 'É'), ('à', 'á'), ('á', 'à'), ('ë', 'ê'), ('ü', 'u'), ('ï', 'í'),
    ('0', 'o'), ('O', 'o'), ('$', 's'), ('S', 's'), ('5', 's'), ('8', 'B'), ('ff', 'fl'), ('fl', 'fi'), ('tl', 'd'), ('lt', 'd'),
    ('w', 'vv'), ('ww', 'w'), ('vv', 'w'), ('r1', 'q'), ('ri', 'n'), ('ry', 'ny'), ('j', 'i'), ('J', 'I'), ('I', 'l'), ('I', 'i'),
    ('ç', 'ão'), ('ao', 'ão'), ('ã', 'a'), ('oe', 'õe'), ('ae', 'ãe'), ('t1', 'u'), ('11', 'n'), ('11', 'll'), ('1', 'í'), ('ii', 'ü'), ('ú', 'ü'),
]
CONF_D = {}
for s, d in CONF:
    CONF_D.setdefault(s, []).append(d)
MAX_SRC = 2

# real-word confusions decided by bigram context: token -> alternative
REALWORD = {
    'ele': 'de', 'ela': 'da', 'elas': 'das', 'cios': 'dos', 'cio': 'do', 'cie': 'de', 'cla': 'da', 'clo': 'do', 'elo': 'do',
    'c': 'e', 'nô': 'no', 'cm': 'em', 'ern': 'em', 'urna': 'uma', 'urn': 'um', 'á': 'à', 'ú': 'a', 'ó': 'o', 'e': 'é',
    'é': 'e', 'a': 'à', 'à': 'a', 'as': 'às', 'às': 'as', 'pôs': 'pós', 'pós': 'pôs', 'da': 'dá', 'dá': 'da', 'so': 'só',
    'se': 'sê', 'tao': 'tão', 'nao': 'não', 'entao': 'então', 'sao': 'são', 'irmao': 'irmão', 'mao': 'mão', 'coraçao': 'coração',
    'ela.': 'da', 'eles': 'dês', 'clê': 'dê', 'cios.': 'dos', 'tôcla': 'tôda', 'tôclas': 'tôdas', 'tocla': 'tôda',
    'ilha': 'lha', 'qne': 'que', 'sna': 'sua', 'sen': 'seu', 'sens': 'seus', 'tn': 'tu', 'un': 'um', 'ns': 'as', 'nos': 'nós',
    'nós': 'nos', 'vos': 'vós', 'vós': 'vos', 'por': 'pôr', 'pôr': 'por', 'para': 'pára', 'pára': 'para', 'aí': 'ai', 'ai': 'aí',
    'ó': 'o', 'o': 'ó', 'e.': 'e', 'êle': 'ele',
}
# tokens that must never be changed by the real-word pass
REALWORD_SAFE = {'e', 'é', 'a', 'à', 'as', 'às', 'o', 'ó', 'da', 'dá', 'se', 'nos', 'nós', 'vos', 'vós', 'por', 'pôr', 'para', 'pára', 'aí', 'ai', 'pôs', 'pós', 'êle', 'ele'}

TOKEN_RE = re.compile(r"[A-Za-zÀ-ÿ0-9$!|]+(?:['’-][A-Za-zÀ-ÿ0-9]+)*|\S")


def char_cleanup(t):
    """Regex-level fixes for common OCR artifacts."""
    t = t.replace('­', '')
    # punctuation glued inside a word: d,o d.o seguncl.o tod.os d;e
    t = re.sub(r'(?<=[A-Za-zÀ-ÿ])[.,;:](?=[a-zà-ÿ])', '', t)
    # apostrophe / quote glued between letters: era'ainda -> era ainda (handled later by lexicon), "d'água" kept
    t = re.sub(r"(?<=[A-Za-zÀ-ÿ]{2})['’‘`´](?=[A-Za-zÀ-ÿ])", ' ', t)
    t = re.sub(r"(?<=\s)['’‘`´](?=[A-Za-zÀ-ÿ])", '', t)
    t = re.sub(r"(?<=[A-Za-zÀ-ÿ,.;:])['’‘`´](?=\s|$)", '', t)
    # systematic glyph confusions seen in some scans
    t = re.sub(r"\\['’]", 'v', t)                      # \'Ós -> vÓs ; Yi\'e -> Yive
    t = re.sub(r"(?<=[A-Za-zÀ-ÿ]),,(?=[A-Za-zÀ-ÿ])", 'v', t)   # de,,edores -> devedores
    t = re.sub(r"l\\[fI]", 'M', t)                        # l\fas -> Mas
    t = re.sub(r"(?<![A-Za-zÀ-ÿ])<\s*l\s*:", 'a', t)      # <l: -> a
    t = t.replace('\\', ' ')
    # stray symbols
    t = re.sub(r'[■•·¬~^`´¨§¦†‡°º<>{}]', ' ', t)
    t = t.replace('$', 's')
    t = re.sub(r'\bE[’\']\s', 'É ', t)
    t = re.sub(r'\s*/\s*', ' ', t)
    t = re.sub(r'(?<=\S)\s+([,.;:!?])', r'\1', t)
    t = re.sub(r',{2,}', ',', t)
    t = re.sub(r'\.{2,}', '...', t)
    t = re.sub(r'\.,', '.', t)
    t = re.sub(r',\.', ',', t)
    t = re.sub(r':\s*:', ':', t)
    t = re.sub(r'\s+-\s+', ' ', t)          # isolated hyphen between words
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'^[\s,.;:\-–—]+', '', t)
    t = re.sub(r'\s*\.\s*\.$', '.', t)
    return t


class Fixer:
    def __init__(self, lex, bigrams):
        self.lex = lex
        self.bi = bigrams
        self.uni = lex.uni
        self.freq = lex.freq
        self.cache = {}

    def score(self, w):
        u = self.uni.get(w, 0) + self.uni.get(w.lower(), 0) * 0.5
        f = self.freq.get(w.lower(), 0)
        return math.log(1 + u * 50) + math.log(1 + f)

    def candidates(self, w):
        out = set()
        n = len(w)
        for i in range(n):
            for L in (1, 2):
                src = w[i:i + L]
                for dst in CONF_D.get(src, ()):
                    out.add(w[:i] + dst + w[i + L:])
        return out

    def fix_word(self, w):
        if w in self.cache:
            return self.cache[w]
        res = w
        if not re.search(r'[A-Za-zÀ-ÿ]', w) or self.lex.known(w):
            self.cache[w] = w
            return w
        c1 = self.candidates(w)
        good = [c for c in c1 if self.lex.known(c)]
        if not good and len(w) <= 16 and len(c1) < 400:
            c2 = set()
            for c in c1:
                c2 |= self.candidates(c)
            good = [c for c in c2 if self.lex.known(c)]
        if good:
            best = max(good, key=self.score)
            if self.score(best) > 0:
                res = best
        else:
            # try splitting a glued pair of words: "souo" -> "sou o", "paravós" -> "para vós"
            best = None
            if not w[:1].isupper():
                for i in range(2, len(w) - 1):
                    a, b = w[:i], w[i:]
                    if self.lex.known(a) and self.lex.known(b) and (len(b) >= 2 or b in ('a', 'o', 'e', 'é', 'à')):
                        sc = min(self.score(a), self.score(b))
                        if best is None or sc > best[0]:
                            best = (sc, a + ' ' + b)
            if best is not None and best[0] > 5.0:
                res = best[1]
        # keep original capitalisation pattern for capitalised words
        if w[:1].isupper() and res[:1].islower():
            res = res[:1].upper() + res[1:]
        self.cache[w] = res
        return res

    def bscore(self, prev, w, nxt):
        # smoothed bigram product with unigram backoff
        def p(a, b):
            return (self.bi.get((a, b), 0) + 0.02 * (1 + self.uni.get(b, 0)) ** 0.5)
        return p(prev, w) * p(w, nxt)

    def realword(self, toks):
        out = list(toks)
        for i, w in enumerate(toks):
            lw = w.lower()
            if lw not in REALWORD:
                continue
            alt = REALWORD[lw]
            if w[:1].isupper():
                alt = alt[:1].upper() + alt[1:]
            prev = toks[i - 1] if i > 0 else '<s>'
            nxt = toks[i + 1] if i + 1 < len(toks) else '</s>'
            s0 = self.bscore(prev, w, nxt)
            s1 = self.bscore(prev, alt, nxt)
            thresh = 8.0 if lw in REALWORD_SAFE else 2.5
            if s1 > thresh * s0:
                out[i] = alt
        return out

    def fix_text(self, t):
        t = char_cleanup(t)
        toks = TOKEN_RE.findall(t)
        fixed = []
        for tk in toks:
            if re.match(r'^[A-Za-zÀ-ÿ0-9$!|]', tk):
                # handle hyphenated compounds piecewise
                if '-' in tk:
                    parts = tk.split('-')
                    parts = [self.fix_word(p) if p else p for p in parts]
                    fixed.append('-'.join(parts))
                else:
                    fixed.append(self.fix_word(tk))
            else:
                fixed.append(tk)
        fixed = self.realword(fixed)
        # rebuild with spacing rules
        s = ''
        for tk in fixed:
            if re.match(r'^[,.;:!?)\]»”’]$', tk):
                s = s.rstrip() + tk + ' '
            elif re.match(r'^[(\[«“‘]$', tk):
                s += tk
            else:
                s += tk + ' '
        s = re.sub(r'\s+', ' ', s).strip()
        s = re.sub(r'\s+([,.;:!?])', r'\1', s)
        return s
