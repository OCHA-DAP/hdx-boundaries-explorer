#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/parquet static/pmtiles tmp
trap 'rm -rf tmp' EXIT

for level in 1 2 3 4; do
  name="unicef_adm${level}"
  input="tmp_unicef/unicef_adm${level}.geojson"
  parquet="static/parquet/${name}.parquet"

  gdal vector pipeline \
    ! read "$input" \
    ! reproject --dst-crs EPSG:4326 \
    ! make-valid \
    ! write "$parquet" \
      --config OGR_ORGANIZE_POLYGONS ONLY_CCW \
      --lco COMPRESSION=ZSTD \
      --lco COMPRESSION_LEVEL=15 \
      --lco GEOMETRY_NAME=geometry \
      --lco USE_PARQUET_GEO_TYPES=YES \
      --overwrite

  tmp_fgb="tmp/${name}.fgb"
  gdal vector set-geom-type "$parquet" "$tmp_fgb" --overwrite
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
    --maximum-zoom=g \
    --no-tile-size-limit \
    "$tmp_labels"
  rm "$tmp_labels"
done
