#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/parquet

for fgb in static/fgb/*.fgb; do
  name=$(basename "$fgb" .fgb)
  gdal vector convert \
    "$fgb" \
    "static/parquet/${name}.parquet" \
    --overwrite \
    --lco=COMPRESSION_LEVEL=15 \
    --lco=COMPRESSION=ZSTD \
    --lco=USE_PARQUET_GEO_TYPES=YES
  echo "$name done"
done
