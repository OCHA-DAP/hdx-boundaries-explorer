#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://gis.unhcr.org/arcgis/rest/services/core_v2"

mkdir -p static/parquet static/pmtiles tmp
trap 'rm -rf tmp' EXIT

for level in 1 2; do
  name="unhcr_adm${level}"
  url="${BASE_URL}/wrl_polbnd_adm${level}_a_unhcr/FeatureServer/0"
  parquet="static/parquet/${name}.parquet"

  query_url="${url}/query?where=gis_status%3D14&orderByFields=objectid&resultRecordCount=1&outFields=*&f=json"

  # Download as Parquet, reproject to 4326, and make geometries valid
  gdal vector pipeline \
    ! read "ESRIJSON:${query_url}" \
    ! reproject --dst-crs EPSG:4326 \
    ! set-field-type --src-field-type DateTime --dst-field-type Date \
    ! make-valid \
    ! write "$parquet" \
      --config OGR_ORGANIZE_POLYGONS ONLY_CCW \
      --lco COMPRESSION=ZSTD \
      --lco COMPRESSION_LEVEL=15 \
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
