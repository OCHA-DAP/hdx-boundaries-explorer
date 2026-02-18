#!/usr/bin/env bash
set -euo pipefail

mkdir -p static/parquet static/pmtiles tmp
trap 'rm -rf tmp' EXIT

for level in 1 2; do
  name="fao_adm${level}"
  url="https://storage.googleapis.com/fao-maps-catalog-data/boundaries/GAUL_2024_L${level}.zip"
  parquet="static/parquet/${name}.parquet"

  curl -fL "$url" -o "tmp/fao_l${level}.zip"
  unzip -q "tmp/fao_l${level}.zip" -d "tmp/fao_l${level}/"
  rm "tmp/fao_l${level}.zip"
  shp=$(find "tmp/fao_l${level}" -name "*.shp" | head -1)

  gdal vector pipeline \
    ! read "$shp" \
    ! reproject --dst-crs EPSG:4326 \
    ! set-field-type --src-field-type DateTime --dst-field-type Date \
    ! make-valid \
    ! write "$parquet" \
      --config OGR_ORGANIZE_POLYGONS ONLY_CCW \
      --lco COMPRESSION=ZSTD \
      --lco COMPRESSION_LEVEL=15 \
      --lco USE_PARQUET_GEO_TYPES=YES \
      --overwrite

  tmp_fgb="tmp/${name}.fgb"
  gdal vector set-geom-type "$parquet" "$tmp_fgb" --multi --overwrite
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
