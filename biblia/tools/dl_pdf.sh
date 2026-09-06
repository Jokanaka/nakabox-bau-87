#!/bin/bash
# usage: dl_pdf.sh "<slug> <chapter>"
set -- $1
b="$1"; c="$2"
out="bt_pdfs/${b}__${c}.pdf"
if [ -s "$out" ]; then exit 0; fi
for i in 1 2 3; do
  curl -sSL --max-time 90 -A "Mozilla/5.0 (compatible; biblia-catolica-app-builder/1.0; +mailto:jokanaka08@gmail.com)" "https://bibliatraduzida.com/edicoes/figueiredo/${b}/${c}.pdf" -o "$out.tmp" && [ -s "$out.tmp" ] && head -c 4 "$out.tmp" | grep -q "%PDF" && mv "$out.tmp" "$out" && exit 0
  sleep $((i*2))
done
echo "FAIL $b $c" >> pdf_failures.txt
