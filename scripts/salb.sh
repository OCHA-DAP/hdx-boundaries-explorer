#!/usr/bin/env bash
set -euo pipefail

# Load credentials from .env if present
[[ -f .env ]] && source .env

ARCGIS_SERVER="https://gis.unocha.org"
BASE_URL="${ARCGIS_SERVER}/server/rest/services/Hosted/Global_AB_1M_fs_gray/FeatureServer"

# Generate ArcGIS token
TOKEN=$(curl -s -X POST \
  "${ARCGIS_SERVER}/portal/sharing/rest/generateToken" \
  --data-urlencode "username=${ARCGIS_USERNAME}" \
  --data-urlencode "password=${ARCGIS_PASSWORD}" \
  --data-urlencode "referer=${ARCGIS_SERVER}/portal" \
  -d "f=json" \
  | jq -r '.token')

mkdir -p static/parquet static/pmtiles tmp
trap 'rm -rf tmp' EXIT

download_layer() {
  local name=$1 layer=$2 make_labels=${3:-true}
  local query_url="${BASE_URL}/${layer}/query?where=1%3D1&orderByFields=objectid&outFields=*&f=json&token=${TOKEN}"
  local parquet="static/parquet/${name}.parquet"
  local tmp_fgb="tmp/${name}.fgb"

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

  gdal vector set-geom-type "$parquet" "$tmp_fgb" --multi --overwrite --skip-errors
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

  if [[ $make_labels == true ]]; then
    local tmp_labels="tmp/${name}_labels.fgb"
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
  fi
}

# Admin 0 = layer 5, Admin 1 = layer 4, Admin 2 = layer 3
for level in 0 1 2; do
  if [[ $level -eq 0 ]]; then layer=5
  elif [[ $level -eq 1 ]]; then layer=4
  else layer=3
  fi
  download_layer "salb_adm${level}" "$layer"
done

# Admin lines = layer 2 (no labels for line geometry)
download_layer salb_lines 2 false
