#!/bin/bash
# download 1950 edition volumes I..XVI (text-layer PDFs) from archive.org
declare -A ITEMS=(
 [01]=6-biblia-vulgata-padre-antonio-pereira-de-figueiredo-01_202007
 [02]=7-biblia-vulgata-padre-antonio-pereira-de-figueiredo-02_202007
 [04]=9-biblia-vulgata-padre-antonio-pereira-de-figueiredo-04_202007
 [05]=10-biblia-vulgata-padre-antonio-pereira-de-figueiredo-05_202007
 [06]=11-biblia-vulgata-padre-antonio-pereira-de-figueiredo-06_20200731
 [07]=12-biblia-vulgata-padre-antonio-pereira-de-figueiredo-07_20200731
 [08]=13-biblia-vulgata-padre-antonio-pereira-de-figueiredo-08_20200731
 [09]=14-biblia-vulgata-padre-antonio-pereira-de-figueiredo-09_20200731
 [10]=15-biblia-vulgata-padre-antonio-pereira-de-figueiredo-10_20200731
 [11]=16-biblia-vulgata-padre-antonio-pereira-de-figueiredo-11_202007
 [12]=17-biblia-vulgata-padre-antonio-pereira-de-figueiredo-12_202007
 [13]=18-biblia-vulgata-padre-antonio-pereira-de-figueiredo-13_202007
 [14]=19-biblia-vulgata-padre-antonio-pereira-de-figueiredo-14_202007
 [15]=20-biblia-vulgata-padre-antonio-pereira-de-figueiredo-15_202007
 [16]=21-biblia-vulgata-padre-antonio-pereira-de-figueiredo-16_202007
)
for v in 01 02 04 05 06 07 08 09 10 11 12 13 14 15 16; do
  id=${ITEMS[$v]}
  out="vols/vol$v.pdf"
  [ -s "$out" ] && continue
  name=$(curl -sS --max-time 60 "https://archive.org/metadata/$id" | python3 -c "
import json,sys
d=json.load(sys.stdin)
pdfs=[f['name'] for f in d.get('files',[]) if f['name'].lower().endswith('.pdf')]
print(pdfs[0] if pdfs else '')")
  if [ -z "$name" ]; then echo "no pdf for $v ($id)" >> vols/errors.txt; continue; fi
  enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$name")
  curl -sSL --max-time 1200 "https://archive.org/download/$id/$enc" -o "$out.tmp" && head -c 4 "$out.tmp" | grep -q "%PDF" && mv "$out.tmp" "$out" || echo "fail $v" >> vols/errors.txt
  echo "done $v $(stat -c %s "$out" 2>/dev/null)" >> vols/progress.txt
done
echo ALLDONE >> vols/progress.txt
