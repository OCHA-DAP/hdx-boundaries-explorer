#!/usr/bin/env bash
set -euo pipefail

# Per-source, per-level comparison stats (feature counts, vertex counts), computed
# from the already-downloaded boundary parquet files. Run after all download:<source>
# scripts. keep in sync with src/lib/sources.ts's ADMIN_SOURCES.
# Trailing 2 fields (junk-name field, pipe-separated exclude values) drop
# filler polygons standing in for areas without a real admin unit — mostly
# lakes/seas, but also non-water cases like the Korea DMZ — plus a few
# hand-picked exact-match named water bodies (e.g. Burundi's "Lake
# Tanganyika") carried as literal named features rather than a placeholder,
# from counts here, downstream of the source data, so this can be tweaked
# without re-downloading boundaries. Blank for sources with no such filler.
# Keep in sync with src/lib/sources.ts's ADMIN_SOURCES junkNameField/
# junkNameValues/namedWaterBodies (combined here into one flat list — bash
# has no need for the generic-vs-hand-picked distinction that TS keeps for
# documentation/safety, since both end up as plain exact-match SQL values).
SOURCES=(
  "ocha:iso3:1 2 3 4::"
  "wfp:iso3:1 2 3 4:adm{level}_name:Under National Administration|N/A|Undefined"
  "unicef:adm0_ucode:1 2 3 4:name:Under National Administration|Lake Tanganyika|N/A|Undefined"
  "unhcr:iso3:1 2::"
  "salb:iso3cd:1 2:adm{level}nm:Waterbody|Name Unknown|Area under National Administration|Under National Administration|Area without administration at 2nd level|Area without administration at the 2nd level|Lake Tanganyika|N/A|N_A|| |Administrative unit not available"
  "fao:ISO3_CODE:1 2:GAUL{level}_NAME:Waterbody|Undefined|Administrative Unit Not Available"
  "wb:ISO_A3:1 2:NAM_{level}:Name Unknown|Under National Administration|Administrative unit not available"
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
  IFS=":" read -r source field levels junk_field junk_values <<<"$entry"
  for level in $levels; do
    file="static/parquet/${source}_adm${level}.parquet"
    [[ -f "$file" ]] || continue

    where_clause=""
    if [[ -n "$junk_field" ]]; then
      resolved_junk_field="${junk_field//\{level\}/$level}"
      IFS='|' read -ra junk_value_list <<<"$junk_values"
      quoted_values=()
      for v in "${junk_value_list[@]}"; do
        quoted_values+=("'${v}'")
      done
      IFS=,
      quoted_values_csv="${quoted_values[*]}"
      unset IFS
      where_clause="WHERE ${resolved_junk_field} NOT IN (${quoted_values_csv})"
    fi

    query="WITH base AS (
        SELECT substr(${field}, 1, 3) AS iso3,
          COUNT(*)::BIGINT AS feature_count,
          SUM(ST_NPoints(geometry))::BIGINT AS total_vertices,
          AVG(ST_NPoints(geometry)) AS avg_vertices
        FROM read_parquet('${file}') ${where_clause} GROUP BY iso3
      ),
      vertex_counts AS (
        SELECT iso3, x, y, COUNT(*) AS n
        FROM (
          SELECT substr(${field}, 1, 3) AS iso3,
            ROUND(ST_X((UNNEST(ST_Dump(ST_Points(geometry)))).geom), 7) AS x,
            ROUND(ST_Y((UNNEST(ST_Dump(ST_Points(geometry)))).geom), 7) AS y
          FROM read_parquet('${file}') ${where_clause}
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
