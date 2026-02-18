#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/parquet static/pmtiles tmp
trap 'rm -rf tmp' EXIT

for level in 1 2 3 4; do
  name="wfp_adm${level}"
  parquet="static/parquet/${name}.parquet"

  # Download and clean
  tmp_dl="tmp/${name}.parquet"
  curl -fL "https://data.earthobservation.vam.wfp.org/public-share/boundaries/ge_adm${level}.parquet" -o "$tmp_dl"
  gdal vector pipeline \
    ! read "$tmp_dl" \
    ! reproject --dst-crs EPSG:4326 \
    ! set-field-type --src-field-type Binary --dst-field-type String \
    ! set-field-type --src-field-type DateTime --dst-field-type Date \
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
