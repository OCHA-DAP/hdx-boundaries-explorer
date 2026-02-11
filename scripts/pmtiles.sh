#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/pmtiles

for fgb in static/fgb/*.fgb; do
  name=$(basename "$fgb" .fgb)
  tippecanoe \
    -o "static/pmtiles/${name}.pmtiles" \
    -l "$name" \
    -zg \
    --no-simplification-of-shared-nodes \
    --simplify-only-low-zooms \
    --force \
    "$fgb"
  echo "$name done"
done
