#!/usr/bin/env python3
"""Gera os ícones do jogo "Acerte a Senha" (cadeado branco sobre laranja).

Uso: python3 senha/tools/gerar_icones.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

LARANJA = (255, 122, 0, 255)
BRANCO = (255, 255, 255, 255)
PASTA = Path(__file__).resolve().parent.parent / "icons"


def desenhar(tam: int) -> Image.Image:
    # Desenha em tamanho grande e reduz depois, para ficar suave.
    g = tam * 4
    img = Image.new("RGBA", (g, g), LARANJA)
    d = ImageDraw.Draw(img)

    # Área segura (ícones "maskable" podem ser recortados nas bordas).
    cx = g / 2
    corpo_l, corpo_t, corpo_r, corpo_b = g * 0.28, g * 0.46, g * 0.72, g * 0.80
    d.rounded_rectangle((corpo_l, corpo_t, corpo_r, corpo_b), radius=g * 0.06, fill=BRANCO)

    # Alça do cadeado (arco grosso).
    esp = g * 0.055
    arco_l, arco_t, arco_r, arco_b = g * 0.355, g * 0.22, g * 0.645, g * 0.56
    d.arc((arco_l, arco_t, arco_r, arco_b), start=180, end=360, fill=BRANCO, width=int(esp))
    d.rectangle((arco_l, (arco_t + arco_b) / 2, arco_l + esp, corpo_t), fill=BRANCO)
    d.rectangle((arco_r - esp, (arco_t + arco_b) / 2, arco_r, corpo_t), fill=BRANCO)

    # Buraco da chave.
    r = g * 0.045
    d.ellipse((cx - r, g * 0.57 - r, cx + r, g * 0.57 + r), fill=LARANJA)
    d.rounded_rectangle((cx - r * 0.45, g * 0.57, cx + r * 0.45, g * 0.70), radius=r * 0.3, fill=LARANJA)

    return img.resize((tam, tam), Image.LANCZOS)


def main() -> None:
    PASTA.mkdir(parents=True, exist_ok=True)
    for nome, tam in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon-32.png", 32)):
        desenhar(tam).convert("RGB").save(PASTA / nome, optimize=True)
        print("ok", nome)


if __name__ == "__main__":
    main()
