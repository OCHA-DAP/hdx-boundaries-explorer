#!/usr/bin/env bash
set -euo pipefail

# Per-source, per-level comparison stats (feature counts, vertex counts), computed
# from the already-downloaded boundary parquet files. Run after all download:<source>
# scripts. keep in sync with src/lib/sources.ts's ADMIN_SOURCES.
SOURCES=(
  "ocha:iso3:1 2 3 4"
  "wfp:iso3:1 2 3 4"
  "unicef:adm0_ucode:1 2 3 4"
  "unhcr:iso3:1 2"
  "salb:iso3cd:1 2"
  "fao:ISO3_CODE:1 2"
  "wb:ISO_A3:1 2"
)

OUT="static/parquet/source_stats.parquet"

# edge_vertices / internal_vertices classify each vertex by how many polygons at that
# level touch its coordinate (rounded to ~1cm to absorb float noise): a location hit by
# exactly one polygon sits on the country's outer edge (coastline/international
# border); a location hit by 2+ polygons is a shared internal boundary. This is a plain
# hash group-by (dump each polygon's vertices, round, GROUP BY x,y) rather than a
# polygon dissolve, so it needs no valid topology — it ran fine on sources (UNHCR, SALB)
# that throw "incorrectly noded inputs" from DuckDB's ST_CoverageUnion_Agg — and it's
# exact rather than approximate, since it doesn't assume every shared vertex is walked
# by exactly two neighbors (a tripoint corner is walked by three or more).
#
# Each source/level runs as its own statement (not one big UNION ALL) so DuckDB doesn't
# try to hold every file's exploded vertex list in memory at once.
statements=""
first=true
for entry in "${SOURCES[@]}"; do
  IFS=":" read -r source field levels <<<"$entry"
  for level in $levels; do
    file="static/parquet/${source}_adm${level}.parquet"
    [[ -f "$file" ]] || continue

    query="WITH base AS (
        SELECT substr(${field}, 1, 3) AS iso3,
          COUNT(*)::BIGINT AS feature_count,
          SUM(ST_NPoints(geometry))::BIGINT AS total_vertices,
          AVG(ST_NPoints(geometry)) AS avg_vertices
        FROM read_parquet('${file}') GROUP BY iso3
      ),
      vertex_counts AS (
        SELECT iso3, x, y, COUNT(*) AS n
        FROM (
          SELECT substr(${field}, 1, 3) AS iso3,
            ROUND(ST_X((UNNEST(ST_Dump(ST_Points(geometry)))).geom), 7) AS x,
            ROUND(ST_Y((UNNEST(ST_Dump(ST_Points(geometry)))).geom), 7) AS y
          FROM read_parquet('${file}')
        )
        GROUP BY iso3, x, y
      ),
      edges AS (
        SELECT iso3,
          SUM(CASE WHEN n = 1 THEN 1 ELSE 0 END)::BIGINT AS edge_vertices,
          SUM(CASE WHEN n > 1 THEN n ELSE 0 END)::BIGINT AS internal_vertices
        FROM vertex_counts GROUP BY iso3
      )
      SELECT '${source}' AS source, ${level} AS level,
        base.iso3, base.feature_count, base.total_vertices, base.avg_vertices,
        edges.edge_vertices, edges.internal_vertices
      FROM base JOIN edges ON base.iso3 = edges.iso3"

    if $first; then
      statements="CREATE TABLE stats AS ${query};"
      first=false
    else
      statements="${statements} INSERT INTO stats ${query};"
    fi
  done
done

if $first; then
  echo "No source parquet files found in static/parquet/ — run the download:<source> scripts first." >&2
  exit 1
fi

duckdb -c "
  LOAD spatial;
  ${statements}
  COPY stats TO '${OUT}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15);
"

echo "Wrote source comparison stats → ${OUT}"
