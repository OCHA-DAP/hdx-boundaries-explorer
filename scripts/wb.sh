#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/parquet static/pmtiles tmp
trap 'rm -rf tmp' EXIT

BASE_URL="https://datacatalogfiles.worldbank.org/ddh-published/0038272/2/DR0095370/World%20Bank%20Official%20Boundaries%20%28GeoPackage%29"

for level in 1 2; do
  name="wb_adm${level}"
  url="${BASE_URL}/World%20Bank%20Official%20Boundaries%20-%20Admin%20${level}.gpkg"
  input="tmp/wb_adm${level}.gpkg"
  parquet="static/parquet/${name}.parquet"

  curl -fL "$url" -o "$input"

  gdal vector pipeline \
    ! read "$input" \
    ! reproject --dst-crs EPSG:4326 \
    ! set-field-type --src-field-type DateTime --dst-field-type Date \
    ! make-valid \
    ! write "$parquet" \
      --config OGR_ORGANIZE_POLYGONS ONLY_CCW \
      --lco COMPRESSION=ZSTD \
      --lco COMPRESSION_LEVEL=15 \
      --lco GEOMETRY_NAME=geometry \
      --lco USE_PARQUET_GEO_TYPES=YES \
      --overwrite

  # Add hover_id: a plain per-file row index — see scripts/ocha.sh for why.
  tmp_hoverid="tmp/${name}_hoverid.parquet"
  duckdb -c "
    COPY (
      SELECT *, row_number() OVER () AS hover_id
      FROM '${parquet}'
    ) TO '${tmp_hoverid}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15);
  "
  mv "$tmp_hoverid" "$parquet"

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
  tmp_labels_parquet="tmp/${name}_labels.parquet"
  duckdb -c "
    LOAD spatial;
    COPY (
      SELECT * EXCLUDE (geometry, geometry_bbox),
             ST_MaximumInscribedCircle(geometry).center AS geometry
      FROM '${parquet}'
    ) TO '${tmp_labels_parquet}';
  "
  gdal vector convert "$tmp_labels_parquet" "$tmp_labels" --overwrite
  rm "$tmp_labels_parquet"
  tippecanoe \
    --output "static/pmtiles/${name}_labels.pmtiles" \
    --layer "${name}_labels" \
    --force \
    --maximum-zoom=g \
    --no-tile-size-limit \
    --drop-rate=1 \
    --no-feature-limit \
    "$tmp_labels"
  rm "$tmp_labels"
done
