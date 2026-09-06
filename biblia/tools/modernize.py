#!/usr/bin/env python3
"""Update 1943/1950 Brazilian orthography to the current (1971/2009) norm, conservatively."""
import re
from spylls.hunspell import Dictionary

WORD_RE = re.compile(r"[A-Za-zÀ-ÿ]+")


class Modernizer:
    def __init__(self, dic_path='pt_BR'):
        self.d = Dictionary.from_files(dic_path)
        self.cache = {}

    def known(self, w):
        try:
            return bool(self.d.lookup(w)) or bool(self.d.lookup(w.lower()))
        except Exception:
            return False

    def word(self, w):
        if w in self.cache:
            return self.cache[w]
        r = self._word(w)
        self.cache[w] = r
        return r

    def _word(self, w):
        orig = w
        # trema is gone
        if 'ü' in w or 'Ü' in w:
            w = w.replace('ü', 'u').replace('Ü', 'U')
        # vôo -> voo, crêem -> creem
        w = re.sub(r'ôo', 'oo', w)
        w = re.sub(r'êe', 'ee', w)
        # grave accent on adverbs / old forms: sòmente, necessàriamente, perpètuamente
        if re.search(r'[òÒèÈ]', w) or (re.search(r'.à', w) and not self.known(w)):
            cand = w.replace('ò', 'o').replace('Ò', 'O').replace('è', 'e').replace('È', 'E').replace('à', 'a').replace('À', 'A')
            if self.known(cand) or re.search(r'[òÒèÈ]', w):
                w = cand
        # forms explicitly dropped by the 2009 agreement
        SPECIAL = {'pára': 'para', 'pêlo': 'pelo', 'pêlos': 'pelos', 'pólo': 'polo', 'pólos': 'polos', 'pêra': 'pera', 'pêras': 'peras'}
        if w.lower() in SPECIAL:
            w = SPECIAL[w.lower()]
        # OCR often reads Ê as É: Éle, Éste, Ésse -> Ele, Este, Esse
        if re.match(r'^[ÉÓ][a-zà-ÿ]', w) and not self.known(w):
            cand = ('E' if w[0] == 'É' else 'O') + w[1:]
            if self.known(cand):
                w = cand
        # differential circumflex (êle, tôda, fêz, sôbre, pôsto, fôr, Êste)
        if re.search(r'[êôÊÔ]', w) and not self.known(w):
            best = None
            for i, ch in enumerate(w):
                if ch in 'êôÊÔ':
                    rep = {'ê': 'e', 'ô': 'o', 'Ê': 'E', 'Ô': 'O'}[ch]
                    cand = w[:i] + rep + w[i + 1:]
                    if self.known(cand):
                        best = cand
                        break
            if best is None:
                cand = w.replace('ê', 'e').replace('ô', 'o').replace('Ê', 'E').replace('Ô', 'O')
                if self.known(cand):
                    best = cand
            if best is not None:
                w = best
        # éi / ói in paroxytones: idéia, Galiléia, heróico, jóia
        if re.search(r'[éó]i', w) and not self.known(w):
            cand = re.sub(r'é(?=i(?:a|as|o|os|ca|cas|co|cos)$)', 'e', w)
            cand = re.sub(r'ó(?=i(?:a|as|o|os|ca|cas|co|cos)$)', 'o', cand)
            if cand != w and (self.known(cand) or not self.known(w)):
                w = cand
        # accent on "ê"/"ô" in pêlo/pára/pólo/pêra types is covered by the dictionary rule above
        # uppercase-initial words: keep capitalisation
        if orig[:1].isupper() and w[:1].islower():
            w = w[:1].upper() + w[1:]
        return w

    def text(self, t):
        def rep(m):
            return self.word(m.group(0))
        return WORD_RE.sub(rep, t)


if __name__ == '__main__':
    m = Modernizer()
    tests = ['êle', 'Êle', 'tôda', 'fêz', 'sôbre', 'pôsto', 'fôr', 'Êxodo', 'pôde', 'dêle', 'nêles', 'sòmente', 'necessàriamente',
             'Galiléia', 'Judéia', 'idéia', 'heróico', 'jóia', 'fiéis', 'papéis', 'herói', 'crêem', 'vôo', 'iniqüidade', 'freqüentavam',
             'pêlo', 'pára', 'côr', 'govêrno', 'êste', 'aquêle', 'vêzes', 'bôca', 'pôr', 'vê', 'Cesaréia', 'Iduméia', 'cortês', 'você',
             'êxito', 'gênero', 'espôsa', 'estrêlas', 'mêdo', 'sêde', 'pôvo', 'lêem', 'dêem', 'perpètuamente', 'à', 'às', 'àquele']
    print(' '.join(f'{t}->{m.word(t)}' for t in tests))
    print(m.text('Êle disse: tôda a terra e sòmente os fiéis de Galiléia crêem. Vôo à cidade.'))
