#!/bin/bash
# usage: crawl.sh <url>
u="$1"
b=$(echo "$u" | sed -E 's#.*/figueiredo/([^/]+)/([0-9]+)/#\1#')
c=$(echo "$u" | sed -E 's#.*/figueiredo/([^/]+)/([0-9]+)/#\2#')
out="bt_pages/${b}__${c}.html"
if [ -s "$out" ]; then exit 0; fi
for i in 1 2 3; do
  curl -sSL --max-time 60 -A "Mozilla/5.0 (compatible; biblia-catolica-app-builder/1.0; +mailto:jokanaka08@gmail.com)" "$u" -o "$out.tmp" && [ -s "$out.tmp" ] && mv "$out.tmp" "$out" && exit 0
  sleep $((i*2))
done
echo "FAIL $u" >> crawl_failures.txt
