#!/usr/bin/env bash
set -euo pipefail

# Per-country polygon match rate (IoU vs the sheet's preferred source). Keep SOURCES in sync
# with stats.sh/sources.ts. Optional first arg restricts to specific levels (e.g. "1"), merging into any existing output.
LEVELS_FILTER="${1:-1 2 3 4}"

SOURCES=(
  "ocha:iso3:1 2 3 4::"
  "wfp:iso3:1 2 3 4:adm{level}_name:Under National Administration|N/A|Undefined"
  "unicef:adm0_ucode:1 2 3 4:name:Under National Administration|Lake Tanganyika|N/A|Undefined"
  "unhcr:iso3:1 2::"
  "salb:iso3cd:1 2:adm{level}nm:Waterbody|Name Unknown|Area under National Administration|Under National Administration|Area without administration at 2nd level|Area without administration at the 2nd level|Lake Tanganyika|N/A|N_A|| |Administrative unit not available"
  "fao:ISO3_CODE:1 2:GAUL{level}_NAME:Waterbody|Undefined|Administrative Unit Not Available"
  "wb:ISO_A3:1 2:NAM_{level}:Name Unknown|Under National Administration|Administrative unit not available"
)

IOU_THRESHOLD=0.8
OUT="static/parquet/source_match.parquet"

SHEET_URL=$(grep VITE_DECISIONS_SHEET_URL .env | cut -d= -f2-)
if [[ -z "$SHEET_URL" ]]; then
  echo "VITE_DECISIONS_SHEET_URL not set in .env, skipping match-rate computation." >&2
  exit 0
fi

DB_FILE=$(mktemp -u /tmp/source_match_XXXXXX).duckdb
RESULTS_CSV=$(mktemp)
DECISIONS_CSV=$(mktemp)
trap 'rm -f "$DB_FILE" "$RESULTS_CSV" "$DECISIONS_CSV"' EXIT

# Materialized once so the per-country queries below don't re-read parquet files each time.
union_parts=()
for entry in "${SOURCES[@]}"; do
  IFS=":" read -r source field levels junk_field junk_values <<<"$entry"
  for level in $levels; do
    [[ " ${LEVELS_FILTER} " == *" ${level} "* ]] || continue
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

    union_parts+=("SELECT '${source}' AS source, ${level} AS level, substr(${field}, 1, 3) AS iso3, geometry FROM read_parquet('${file}') ${where_clause}")
  done
done

if [[ ${#union_parts[@]} -eq 0 ]]; then
  echo "No source parquet files found in static/parquet/, run the download:<source> scripts first." >&2
  exit 1
fi

units_sql=""
for part in "${union_parts[@]}"; do
  if [[ -z "$units_sql" ]]; then
    units_sql="$part"
  else
    units_sql="${units_sql} UNION ALL ${part}"
  fi
done

duckdb "$DB_FILE" -c "
  LOAD spatial;
  LOAD httpfs;
  SET geometry_always_xy = true;

  CREATE TABLE units AS
    SELECT ROW_NUMBER() OVER () AS unit_id, source, level, iso3, geometry FROM ( ${units_sql} );
  CREATE INDEX idx_units_iso3 ON units(iso3);

  CREATE TABLE decisions AS
    SELECT upper(trim(iso3)) AS iso3, lower(trim(selected_source)) AS preferred_source
    FROM read_csv('${SHEET_URL}', header=true)
    WHERE selected_source IS NOT NULL
      AND lower(trim(selected_source)) NOT IN ('', 'null');

  COPY decisions TO '${DECISIONS_CSV}' (FORMAT CSV, HEADER true);
"

echo "source,level,iso3,preferred_source,matched_count" >"$RESULTS_CSV"

total=$(($(wc -l <"$DECISIONS_CSV") - 1))
i=0
first_row=true
while IFS=, read -r iso3 preferred_source; do
  if $first_row; then
    first_row=false
    continue
  fi
  [[ -z "$iso3" ]] && continue
  i=$((i + 1))
  echo "[$i/$total] ${iso3} (preferred: ${preferred_source})" >&2

  # One country-scoped query at a time (a global join was too slow). ST_MakeValid guards
  # against GEOS TopologyExceptions on real-world geometry; a failed query is skipped, not fatal.
  duckdb "$DB_FILE" -csv -noheader -c "
    LOAD spatial;
    SET geometry_always_xy = true;
    WITH valid_units AS (
      SELECT unit_id, source, level, ST_MakeValid(geometry) AS geometry
      FROM units WHERE iso3 = '${iso3}'
    ),
    candidate_sources AS (
      SELECT DISTINCT s.source, s.level
      FROM valid_units s
      WHERE s.source != '${preferred_source}'
        AND EXISTS (
          SELECT 1 FROM valid_units p WHERE p.source = '${preferred_source}' AND p.level = s.level
        )
    ),
    pairs AS (
      SELECT s.unit_id, s.source, s.level,
        MAX(
          ST_Area_Spheroid(ST_Intersection(s.geometry, p.geometry))
          / ST_Area_Spheroid(ST_Union(s.geometry, p.geometry))
        ) AS best_iou
      FROM valid_units s
      JOIN valid_units p ON p.level = s.level AND p.source = '${preferred_source}'
      WHERE s.source != '${preferred_source}' AND ST_Intersects(s.geometry, p.geometry)
      GROUP BY s.unit_id, s.source, s.level
    )
    SELECT cs.source, cs.level, '${iso3}' AS iso3, '${preferred_source}' AS preferred_source,
      COALESCE(COUNT(*) FILTER (WHERE pr.best_iou >= ${IOU_THRESHOLD}), 0)::BIGINT AS matched_count
    FROM candidate_sources cs
    LEFT JOIN pairs pr ON pr.source = cs.source AND pr.level = cs.level
    GROUP BY cs.source, cs.level;
  " >>"$RESULTS_CSV" || echo "  [$i/$total] ${iso3}: query failed, skipping" >&2
done <"$DECISIONS_CSV"

NEW_OUT=$(mktemp -u /tmp/source_match_out_XXXXXX).parquet
trap 'rm -f "$DB_FILE" "$RESULTS_CSV" "$DECISIONS_CSV" "$NEW_OUT"' EXIT

if [[ -f "$OUT" ]]; then
  # New rows win over any existing row for the same (source, level, iso3), since a
  # re-run for a level supersedes whatever was previously computed for it.
  duckdb -c "
    COPY (
      SELECT source, level, iso3, preferred_source, matched_count
      FROM (
        SELECT source, level::INTEGER AS level, iso3, preferred_source, matched_count::BIGINT AS matched_count, 0 AS priority
        FROM read_csv('${RESULTS_CSV}', header=true)
        UNION ALL
        SELECT source, level, iso3, preferred_source, matched_count, 1 AS priority
        FROM read_parquet('${OUT}')
      )
      QUALIFY ROW_NUMBER() OVER (PARTITION BY source, level, iso3 ORDER BY priority) = 1
    ) TO '${NEW_OUT}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15);
  "
else
  duckdb -c "
    COPY (
      SELECT source, level::INTEGER AS level, iso3, preferred_source, matched_count::BIGINT AS matched_count
      FROM read_csv('${RESULTS_CSV}', header=true)
    ) TO '${NEW_OUT}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15);
  "
fi
mv "$NEW_OUT" "$OUT"

echo "Wrote source match-rate stats to ${OUT}"
