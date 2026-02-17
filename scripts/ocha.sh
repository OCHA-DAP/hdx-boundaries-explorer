#!/usr/bin/env bash
set -euo pipefail

API="https://data.humdata.org/api/3/action/package_show?id=cod-ab-global"
FILENAME="global_admin_boundaries_original_latest.gdb.zip"

mkdir -p static/parquet static/pmtiles tmp
trap 'rm -rf tmp' EXIT

# Resolve download URL via HDX API (resource_id may change; filename is stable)
url=$(curl -fsSL "$API" | jq -r --arg f "$FILENAME" '.result.resources[] | select(.name == $f) | .url')
curl -fL "$url" -o "tmp/ocha.gdb.zip"

# Extract
unzip -q "tmp/ocha.gdb.zip" -d tmp/
gdb=$(find tmp -maxdepth 2 -name "*.gdb" -type d | head -1)

for level in 1 2 3 4 5; do
  name="ocha_adm${level}"
  layer="admin${level}"
  parquet="static/parquet/${name}.parquet"

  # Make geometries valid and write compressed parquet directly from GDB
  gdal vector pipeline \
    ! read "$gdb" --input-layer-name "$layer" \
    ! make-valid \
    ! write "$parquet" \
      --lco COMPRESSION=ZSTD \
      --lco COMPRESSION_LEVEL=15 \
      --lco USE_PARQUET_GEO_TYPES=YES \
      --overwrite

  # Convert parquet → FGB → pmtiles
  tmp_fgb="tmp/${name}.fgb"
  gdal vector convert "$parquet" "$tmp_fgb" --overwrite
  tippecanoe \
    --output "static/pmtiles/${name}.pmtiles" \
    --layer "$name" \
    --force \
    --maximum-zoom=g \
    --no-simplification-of-shared-nodes \
    --no-tile-size-limit \
    --simplify-only-low-zooms \
    "$tmp_fgb"
  rm "$tmp_fgb"
done
