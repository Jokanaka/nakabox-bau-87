# Bíblia Católica — app (PWA)

Aplicativo de Bíblia **Católica Apostólica Romana** no estilo do app YouVersion, com os **73 livros** do cânon católico
(incluindo Tobias, Judite, Sabedoria, Eclesiástico, Baruc, 1 e 2 Macabeus e as partes gregas de Ester e Daniel).

Funciona como site e como aplicativo instalável (PWA) no celular, sem internet depois de instalado.

## Como usar

- No ar: **https://jokanaka.github.io/nakabox-bau-87/biblia/** (GitHub Pages) e também no Vercel (projeto `biblia`, pasta raiz `biblia`).
- No celular: abra o endereço, toque em **Compartilhar → Adicionar à Tela de Início** (iPhone) ou aceite o aviso **Instalar** (Android).
- Localmente: `cd biblia && python3 -m http.server 8080` e abra `http://localhost:8080/`.

Não há etapa de build: é HTML, CSS e JavaScript puro (módulos ES).

## Recursos

- **Leitor**: livro/capítulo, três versões (Figueiredo em português, Vulgata Clementina em latim, Douay-Rheims em inglês),
  tamanho de fonte, serifa/sem serifa, temas claro/sépia/escuro, deslizar para mudar de capítulo.
- **Leitura em voz alta** com barra de controle, escolha da voz (preferindo a masculina do aparelho), estilo "narração" (pausas entre frases e versículos, apresentação do capítulo), velocidade, tom, continuação automática no próximo capítulo, temporizador para parar (em N minutos ou num horário) e controles na tela de bloqueio; também nas orações e nas leituras da Missa.
- **Narrador masculino offline** (opcional, grátis): voz Piper `pt_BR-faber-medium` (MIT) sintetizada no próprio aparelho num Web Worker (`js/piper-worker.js`, runtime `@mintplex-labs/piper-tts-web` vendorizado em `js/vendor/piper/`, onnxruntime-web e piper-wasm carregados dos CDNs e guardados pelo service worker); baixa ~90 MB uma vez.
- **Narrador humano na nuvem** (opcional): com a própria chave do Google Cloud Text-to-Speech, o app usa as vozes neurais do Google (Chirp 3 HD, Neural2), masculinas e muito naturais, guardando cada trecho no aparelho para não gastar a cota duas vezes. A chave fica só no aparelho e não entra no backup.
- **Versículos**: destaques em 6 cores, notas, favoritos, copiar, compartilhar como texto ou imagem, comparar versões.
- **Busca** em toda a Bíblia ou em um só livro (sem acentos), frases entre aspas e referências (`Jo 3,16`, `Sl 22`).
- Salmos com a numeração da Vulgata e, no cabeçalho, a numeração hebraica das Bíblias modernas.
- **Planos de leitura**: Bíblia em 1 e 2 anos, Novo Testamento, Evangelhos, Salmos, Deuterocanônicos, Advento, Quaresma, Semana Santa, novenas etc.
- **Orações** tradicionais (com latim quando existe), **Santo Rosário** guiado com os mistérios do dia e **Terço da Divina Misericórdia** guiado.
- **Liturgia**: calendário litúrgico (tempos, ciclos A/B/C e I/II, cores, solenidades e festas, calendário do Brasil) e leituras da Missa.
- **Início**: versículo do dia, continuar lendo, plano de hoje, leituras de hoje, sequência de dias.
- Tudo é guardado só no aparelho (localStorage), com exportação/importação de backup.

## Textos e licenças

| Versão | Fonte | Situação |
| --- | --- | --- |
| Bíblia Sagrada — Pe. Antônio Pereira de Figueiredo (tradução da Vulgata, edição de 1950) | transcrição de [bibliatraduzida.com](https://bibliatraduzida.com) (536 capítulos) + OCR dos volumes digitalizados no [Internet Archive](https://archive.org) (798 capítulos) | domínio público; ortografia atualizada por este projeto |
| Vulgata Clementina | [bolls.life](https://bolls.life) | domínio público |
| Douay-Rheims (Challoner) | bibliatraduzida.com + bolls.life | domínio público |
| Leituras da Missa (referências) | [catholic-readings-api](https://github.com/cpbjr/catholic-readings-api) (MIT) + tabela complementar (Brasil, Ano C) | referências litúrgicas |

Os capítulos vindos de OCR são sinalizados no leitor ("Texto extraído por OCR") e trazem link para a página digitalizada original.
O relatório dos capítulos com versículos faltando está em `tools/relatorio-ocr.txt`.

## Estrutura

```
biblia/
  index.html, manifest.webmanifest, sw.js   # casca do app e service worker (offline)
  css/app.css
  js/app.js        # roteador, início, "mais", configurações
  js/reader.js     # leitor, seletor de livros, busca, áudio
  js/features.js   # planos, orações, rosário, liturgia
  js/liturgy.js    # cálculo do calendário litúrgico e leituras
  js/data.js, search.js, store.js, plans.js, prayers.js, rosary.js, share.js, ui.js, util.js
  data/books.json                 # catálogo dos 73 livros
  data/figueiredo|vulgata|drb/    # um JSON por livro: {id, name, chapters:[{n, title?, heading?, verses:[...], src}]}
  data/lectionary.json            # leituras por dia litúrgico (chave -> leituras)
  tools/                          # scripts Python usados para gerar os dados (ver abaixo)
```

## Regerar os dados (opcional)

Os scripts em `tools/` documentam como o texto foi produzido:

1. `crawl.sh` / `parse_bt.py` — baixa e interpreta os capítulos já transcritos em bibliatraduzida.com.
2. `dl_vols.sh` — baixa os volumes da edição de 1950 (archive.org, PDFs com camada de texto OCR).
3. `volmap2.py` + `run_vols.py` (ou `dl_pdf.sh` + `run_all.py`) — localiza cada capítulo e extrai os versículos (`ocr_extract.py`),
   validando a contagem de versículos pela Vulgata.
4. `ocr_fix.py` — corrige erros típicos de OCR com léxico, bigramas, dicionário hunspell (`pt_BR`), confusões aprendidas por alinhamento (`learn_conf.py` → `learned_conf.json`) e junção de palavras partidas por espaços espúrios ("anunciar ás" → "anunciarás"); `modernize.py` — atualiza a ortografia de 1950 (êle → ele, tôda → toda).
5. `assemble.py` — junta transcrição e OCR, gera `data/figueiredo/*.json` e `data/books.json`.
6. `build_versions.py` — Vulgata e Douay-Rheims; `build_lectionary.py` — leituras da Missa.
7. `validate.py` — mede a taxa de erro do OCR contra capítulos transcritos (referência); `e2e.mjs` — testes de navegador (Playwright).

Dependências: Python 3.11, `pymupdf`, `spylls` (com o dicionário `pt_BR` do LibreOffice) e Node 22 com `playwright`.
