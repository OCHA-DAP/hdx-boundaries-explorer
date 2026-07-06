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
IN="static/parquet/salb_adm0.parquet"
OUT="static/parquet/country_bbox.parquet"

[[ -f "$IN" ]] || {
  echo "$IN not found — run download:salb first." >&2
  exit 1
}

duckdb -c "
  LOAD spatial;
  COPY (
    WITH pts AS (
      SELECT DISTINCT iso3cd AS iso3,
        ST_X((UNNEST(ST_Dump(ST_Points(geometry)))).geom) AS lon
      FROM '${IN}'
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
    SELECT f.iso3, f.xmin, s.geometry_bbox.ymin AS ymin, f.xmax, s.geometry_bbox.ymax AS ymax
    FROM fit_lon f
    JOIN '${IN}' s ON s.iso3cd = f.iso3
  ) TO '${OUT}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15);
"

echo "Wrote country fit bboxes → ${OUT}"
