#!/usr/bin/env python3
"""OCR post-correction for Portuguese (1950 orthography) verse text."""
import re, math, os

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
    ('111', 'm'), ('1110', 'mo'), ('110', 'no'), ('10', 'lo'), ('11', 'u'), ('1', 's'), ('f', 't'), ('l', 'b'),
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

# learned from aligning OCR output with the transcription (learn_conf.py)
LEARNED_WORDS = {}
try:
    import os, json as _json
    _lp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'learned_conf.json')
    if os.path.exists(_lp):
        _L = _json.load(open(_lp, encoding='utf-8'))
        for _s, _d, _n in _L.get('chars', []):
            if _s and _d not in CONF_D.get(_s, []):
                CONF_D.setdefault(_s, []).append(_d)
        LEARNED_WORDS = _L.get('words', {})
        for _x, _y in _L.get('real', {}).items():
            REALWORD.setdefault(_x.lower(), _y.lower())
except Exception:
    pass

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
    # parentheses holding only OCR junk, e.g. "(. ' í)" for a footnote mark "(5)"
    t = re.sub(r'\(\s*[^A-Za-zÀ-ÿ()]{0,5}\s*\)', ' ', t)
    t = re.sub(r'\(\s*[^A-Za-zÀ-ÿ()]{0,5}[íìlI!|]\s*\)', ' ', t)
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
    t = strip_footnote_runs(t)
    t = re.sub(r'^[\s,.;:\-–—]+', '', t)
    t = re.sub(r'\s*\.\s*\.$', '.', t)
    return t


def strip_footnote_runs(t):
    """Footnote numbers that leaked into the verse: a run of consecutive small numbers ("palavras. 2 3 4 E") or a lone
    small number at the end of the verse ("... mas 1")."""
    def run(m):
        nums = [int(x) for x in m.group(0).split()]
        if len(nums) >= 2 and all(b == a + 1 for a, b in zip(nums, nums[1:])):
            return ' '
        return m.group(0)
    t = re.sub(r'(?<![\d,.:])\b\d{1,2}(?:\s\d{1,2})+\b(?![\d,.:]\d)', run, t)
    t = re.sub(r'(?<=[A-Za-zÀ-ÿ,;:.!?])\s+\d{1,2}\s*([.:;,!?]?)\s*$', r'\1', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


class Fixer:
    def __init__(self, lex, bigrams, spell=None, min_freq=None):
        if min_freq is None and os.environ.get('OCRFIX_MINFREQ'):
            min_freq = int(os.environ['OCRFIX_MINFREQ'])
        if min_freq is not None and min_freq != getattr(lex, 'min_freq', 5):
            from ocr_extract import Lexicon
            lex = Lexicon(lex.uni, lex.freq, spell=lex.spell, min_freq=min_freq)
        self.lex = lex
        self.bi = bigrams
        self.uni = lex.uni
        self.freq = lex.freq
        self.spell = spell
        self.use_join = os.environ.get('OCRFIX_JOIN', '1') == '1'
        self.spell_in_fix = os.environ.get('OCRFIX_SPELLFIX', '1') == '1'
        self.cache = {}
        self.kcache = {}
        self.joins = []      # (a, b, result) decisions, for inspection

    def known_full(self, w):
        """Known to the corpus lexicon or to the hunspell dictionary (full inflection)."""
        if w in self.kcache:
            return self.kcache[w]
        r = self.lex.known(w)
        if not r and self.spell is not None and re.search(r'[A-Za-zÀ-ÿ]', w):
            try:
                r = bool(self.spell.lookup(w)) or bool(self.spell.lookup(w.lower()))
            except Exception:
                r = False
        self.kcache[w] = r
        return r

    def ucount(self, w):
        lw = w.lower()
        return self.uni.get(lw, 0) + (self.uni.get(w, 0) if w != lw else 0)

    def affix_known(self, w, exact=False):
        """Accepted by hunspell as an inflected form (no compounding); a prefixed analysis only counts
        when the word without the prefix is not a corpus word ('anunciarás' = a+nunciar+ás ok, 'alembrança' = a+lembrança no).
        exact=True: only a plain dictionary entry (no affixes), used for proper nouns."""
        if self.spell is None:
            return False
        key = ('af', w, exact)
        if key in self.kcache:
            return self.kcache[key]
        r = False
        try:
            for form in self.spell.lookuper.good_forms(w, capitalization=True, allow_nosuggest=True):
                if type(form).__name__ != 'AffixForm':
                    continue
                pre = getattr(form, 'prefix', None)
                suf = getattr(form, 'suffix', None)
                if exact:
                    if (pre is None or not pre.add) and (suf is None or not suf.add):
                        r = True
                        break
                    continue
                if pre is None or not pre.add or not self.lex.known(w[len(pre.add):]):
                    r = True
                    break
        except Exception:
            r = False
        self.kcache[key] = r
        return r

    FREQ_WORD = 50   # corpus count above which a token is an ordinary word that is never glued to a known neighbour
    ONE_LETTER_WORDS = set('aeoéàóáêôAEOÉÀÓÁ')

    def _known_part(self, w):
        if len(w) == 1 and w not in self.ONE_LETTER_WORDS:
            return False
        return self.lex.known(w)

    def _fixable(self, w):
        """An OCR error that the word-level fixer corrects on its own (a split into two words does not count)."""
        f = self.fix_word(w)
        return f != w and ' ' not in f

    def try_join(self, a, b):
        """Join a word broken by a spurious space: 'anunciar ás' -> 'anunciarás', 'regozije mo-nos' -> 'regozijemo-nos',
        'J srael' -> 'Israel'. Conservative: never touches pairs seen in the transcribed corpus or two ordinary words."""
        if not re.match(r'^[A-Za-zÀ-ÿ0-9]+$', a) or not re.match(r'^[a-zà-ÿ0-9]+(?:-[a-zà-ÿ]+)*$', b):
            return None
        head, _, rest = b.partition('-')
        core = a + head
        if len(core) < 4 or not re.search(r'[A-Za-zÀ-ÿ]', core) or (a.isdigit() and head.isdigit()):
            return None
        if self.bi.get((a, b), 0) > 0 or self.bi.get((a.lower(), b), 0) > 0:
            return None                      # the pair occurs in the transcribed corpus
        ka, kb = self._known_part(a), self._known_part(head)
        ua, ub = self.ucount(a), self.ucount(head)
        if ka and kb and (ua >= self.FREQ_WORD or ub >= self.FREQ_WORD or (ua >= 5 and ub >= 5)):
            return None                      # two ordinary words
        if a.isdigit() and kb and ub >= 5:
            return None                      # stray digit (footnote mark) before a real word
        if head.isdigit() and ka:
            return None                      # stray digit after a real word
        joined = core + ('-' + rest if rest else '')
        if self.ucount(core) >= 2 and core.lower() not in (a.lower(), head):
            return joined                    # the glued word is attested in the transcribed corpus
        if not ka and len(a) > 1 and self._fixable(a):
            return None                      # 'a' is an OCR error fixable on its own
        if not kb and len(head) > 1 and self._fixable(head):
            return None
        if core[:1].islower():
            if len(a) > 2 and len(head) > 1 and self.affix_known(core):
                return joined                # valid inflected form (e.g. rare verb forms absent from the corpus)
        elif ua <= 2 and ub <= 2 and self.affix_known(core, exact=True):
            return joined                    # proper noun listed in the dictionary
        if (not ka or not kb) and not rest and ua < self.FREQ_WORD:
            cands = [c for c in self.candidates(core) if c.lower() != core.lower() and self.ucount(c) >= 5]
            if cands:
                return max(cands, key=self.score)   # e.g. 'J srael' -> 'Israel', 'N orne' -> 'Nome'
        return None

    def join_pass(self, toks):
        out = []
        i = 0
        while i < len(toks):
            if i + 1 < len(toks):
                j = self.try_join(toks[i], toks[i + 1])
                if j is not None:
                    self.joins.append((toks[i], toks[i + 1], j))
                    out.append(j)
                    i += 2
                    continue
            out.append(toks[i])
            i += 1
        return out

    def score(self, w):
        u = self.uni.get(w, 0) + self.uni.get(w.lower(), 0) * 0.5
        f = self.freq.get(w.lower(), 0)
        return math.log(1 + u * 50) + math.log(1 + f)

    def candidates(self, w):
        out = set()
        n = len(w)
        for i in range(n):
            for L in (1, 2, 3, 4):
                src = w[i:i + L]
                if L > 2 and not src.isdigit():
                    continue
                for dst in CONF_D.get(src, ()):
                    out.add(w[:i] + dst + w[i + L:])
        return out

    def fix_word(self, w):
        if w in self.cache:
            return self.cache[w]
        if w in LEARNED_WORDS:
            self.cache[w] = LEARNED_WORDS[w]
            return LEARNED_WORDS[w]
        res = w
        if not re.search(r'[A-Za-zÀ-ÿ]', w) or self.lex.known(w) or (self.spell_in_fix and self.known_full(w)):
            self.cache[w] = w
            return w
        c1 = self.candidates(w)
        good = [c for c in c1 if self.lex.known(c)]
        if not good and len(w) <= 16 and len(c1) < 400:
            c2 = set()
            for c in c1:
                c2 |= self.candidates(c)
            # two edits: only words attested in the corpus or accepted by the dictionary (the frequency list has junk)
            good = [c for c in c2 if self.lex.known(c) and (self.ucount(c) >= 1 or self.affix_known(c))]
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
        if self.use_join:
            toks = self.join_pass(toks)
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
        for i, tk in enumerate(fixed):
            if tk == '0' and 0 < i < len(fixed) - 1 and re.match(r'^[A-Za-zÀ-ÿ]+$', fixed[i - 1]) and re.match(r'^[a-zà-ÿ]+$', fixed[i + 1]):
                fixed[i] = 'o'               # "tudo 0 que" -> "tudo o que"
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
