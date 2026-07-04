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

union_sql=""
for entry in "${SOURCES[@]}"; do
  IFS=":" read -r source field levels <<<"$entry"
  for level in $levels; do
    file="static/parquet/${source}_adm${level}.parquet"
    [[ -f "$file" ]] || continue

    query="SELECT '${source}' AS source, ${level} AS level,
      substr(${field}, 1, 3) AS iso3,
      COUNT(*)::BIGINT AS feature_count,
      SUM(ST_NPoints(geometry))::BIGINT AS total_vertices,
      AVG(ST_NPoints(geometry)) AS avg_vertices
      FROM read_parquet('${file}') GROUP BY iso3"

    if [[ -z "$union_sql" ]]; then
      union_sql="$query"
    else
      union_sql="$union_sql UNION ALL $query"
    fi
  done
done

if [[ -z "$union_sql" ]]; then
  echo "No source parquet files found in static/parquet/ — run the download:<source> scripts first." >&2
  exit 1
fi

duckdb -c "
  LOAD spatial;
  COPY (${union_sql}) TO '${OUT}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15);
"

echo "Wrote source comparison stats → ${OUT}"
