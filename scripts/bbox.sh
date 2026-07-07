#!/usr/bin/env bash
set -euo pipefail

# Per-country fit bbox for the map's "zoom to country" camera move, computed from
# SALB's adm0 layer. A plain min/max of longitude (what GDAL's GeoParquet covering
# bbox column gives us) is wrong for any country with territory near the
# antimeridian (NZL's Chatham Islands, FJI, RUS, USA's Aleutians): the naive box
# spans the "wrong way" around the globe instead of the short way across 180.
#
# Fix: dump every vertex's longitude, sort them, and find the largest gap in that
# circular sequence — the empty arc with no vertices in it. The bbox is the
# complement of that gap, unwrapped past 180 if the gap turned out not to be the
# ordinary wrap-around one. This also degrades correctly for ordinary countries
# (the largest gap is just the wrap-around one, giving the usual min/max).
#
# ymin/ymax are aggregated from the same per-vertex dump as lon, rather than
# pulled from GDAL's per-feature geometry_bbox column via a join back to the
# source table — a country with more than one adm0 row (e.g. GBR, which SALB
# carries as both a "United Kingdom" feature and a stray "Northern Ireland
# (United Kingdom)" feature, both tagged iso3cd=GBR) would otherwise fan out
# that join into one output row per feature, and whichever row happened to
# land last when written to parquet would silently win at read time.
IN="static/parquet/salb_adm0.parquet"
OUT="static/parquet/country_bbox.parquet"

[[ -f "$IN" ]] || {
  echo "$IN not found — run download:salb first." >&2
  exit 1
}

duckdb -c "
  LOAD spatial;
  COPY (
    WITH dumped AS (
      SELECT iso3cd AS iso3, (UNNEST(ST_Dump(ST_Points(geometry)))).geom AS pt
      FROM '${IN}'
    ),
    pts AS (
      SELECT DISTINCT iso3, ST_X(pt) AS lon, ST_Y(pt) AS lat FROM dumped
    ),
    lat_bounds AS (
      SELECT iso3, min(lat) AS ymin, max(lat) AS ymax FROM pts GROUP BY iso3
    ),
    sorted AS (
      SELECT iso3, lon,
        LEAD(lon) OVER (PARTITION BY iso3 ORDER BY lon) AS next_lon,
        FIRST_VALUE(lon) OVER (PARTITION BY iso3 ORDER BY lon) AS first_lon
      FROM pts
    ),
    gaps AS (
      SELECT iso3, lon, next_lon, first_lon,
        COALESCE(next_lon, first_lon + 360) - lon AS gap_size
      FROM sorted
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY iso3 ORDER BY gap_size DESC) AS rk
      FROM gaps
    ),
    fit_lon AS (
      SELECT iso3,
        CASE WHEN next_lon IS NULL THEN first_lon ELSE next_lon END AS xmin,
        CASE WHEN next_lon IS NULL THEN lon ELSE lon + 360 END AS xmax
      FROM ranked WHERE rk = 1
    )
    SELECT f.iso3, f.xmin, lb.ymin, f.xmax, lb.ymax
    FROM fit_lon f
    JOIN lat_bounds lb ON lb.iso3 = f.iso3
  ) TO '${OUT}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15);
"

echo "Wrote country fit bboxes → ${OUT}"
