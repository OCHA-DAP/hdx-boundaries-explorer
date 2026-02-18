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
rm "tmp/ocha.gdb.zip"
gdb=$(find tmp -maxdepth 2 -name "*.gdb" -type d | head -1)

for level in 1 2 3 4; do
  name="ocha_adm${level}"
  layer="admin${level}"
  parquet="static/parquet/${name}.parquet"

  # Make geometries valid and write compressed parquet directly from GDB
  gdal vector pipeline \
    ! read "$gdb" --input-layer "$layer" \
    ! reproject --dst-crs EPSG:4326 \
    ! set-field-type --src-field-type DateTime --dst-field-type Date \
    ! make-valid \
    ! write "$parquet" \
      --config OGR_ORGANIZE_POLYGONS ONLY_CCW \
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

  # Generate Maximum Inscribed Circle label points → pmtiles
  tmp_labels="tmp/${name}_labels.fgb"
  duckdb -c "
    LOAD spatial;
    COPY (
      SELECT * EXCLUDE (geometry, geometry_bbox),
             ST_MaximumInscribedCircle(geometry).center AS geometry
      FROM read_parquet('${parquet}')
    ) TO '${tmp_labels}' WITH (FORMAT GDAL, DRIVER 'FlatGeobuf');
  "
  tippecanoe \
    --output "static/pmtiles/${name}_labels.pmtiles" \
    --layer "${name}_labels" \
    --force \
    --drop-rate=1 \
    --maximum-zoom=g \
    --no-feature-limit \
    --no-tile-size-limit \
    "$tmp_labels"
  rm "$tmp_labels"
done
