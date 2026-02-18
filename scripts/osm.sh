#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/parquet static/pmtiles tmp
trap 'rm -rf tmp' EXIT

name="osm_land"
parquet="static/parquet/${name}.parquet"

# Download and extract
zip="tmp/land-polygons-complete-4326.zip"
curl -fL "https://osmdata.openstreetmap.de/download/land-polygons-complete-4326.zip" -o "$zip"
unzip -q "$zip" -d tmp/

# Convert shapefile → parquet, making geometries valid
shp="tmp/land-polygons-complete-4326/land_polygons.shp"
gdal vector pipeline \
  ! read "$shp" \
  ! make-valid \
  ! write "$parquet" \
    --lco COMPRESSION=ZSTD \
    --lco COMPRESSION_LEVEL=15 \
    --lco GEOMETRY_NAME=geometry \
    --lco USE_PARQUET_GEO_TYPES=YES \
    --overwrite

# Convert parquet → temp fgb → pmtiles, then delete fgb
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
