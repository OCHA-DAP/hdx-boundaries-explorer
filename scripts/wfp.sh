#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/parquet static/pmtiles

for level in 1 2 3 4; do
  name="wfp_adm${level}"
  parquet="static/parquet/${name}.parquet"

  # Download and clean
  tmp_dl=$(mktemp /tmp/tmp.XXXXXX.parquet)
  curl -fL "https://data.earthobservation.vam.wfp.org/public-share/boundaries/ge_adm${level}.parquet" -o "$tmp_dl"
  gdal vector pipeline \
    read "$tmp_dl" ! \
    make-valid ! \
    set-field-type --src-field-type Binary --dst-field-type String ! \
    write "$parquet" \
      --overwrite \
      --lco COMPRESSION=ZSTD \
      --lco COMPRESSION_LEVEL=15 \
      --lco USE_PARQUET_GEO_TYPES=YES
  rm "$tmp_dl"

  # Convert parquet → temp fgb → pmtiles, then delete fgb
  tmp_fgb=$(mktemp /tmp/tmp.XXXXXX.fgb)
  gdal vector convert "$parquet" "$tmp_fgb" --overwrite
  tippecanoe \
    -o "static/pmtiles/${name}.pmtiles" \
    -l "$name" \
    -zg \
    --no-tile-size-limit \
    --no-simplification-of-shared-nodes \
    --simplify-only-low-zooms \
    --force \
    "$tmp_fgb"
  rm "$tmp_fgb"
done
