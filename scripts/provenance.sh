#!/usr/bin/env bash
set -euo pipefail

# Per-source provenance (data provider, date the source was last updated).
# OCHA and FAO have no provenance fields embedded in their boundary layers, so
# they're built from raw exports committed under scripts/data/provenance/ —
# periodically replaced by hand whenever a contributor submits an updated
# snapshot (format varies submission to submission — see the extraction notes
# below). WFP, UNHCR, World Bank, and UNGIS/SALB all carry provenance directly
# in their downloaded boundary layers, which is richer and more current than
# any hand-compiled snapshot of them, so those are read straight from
# static/parquet/*.parquet instead. Must run after every download:<source>
# script. UNICEF has no usable provenance field in its layer (the closest it
# gets is SALB_ID/WFP_ID/UNDP_ID cross-reference columns, but those overlap
# too much per row to reliably indicate a single true source).
#
# fao.csv's provider column is condensed from FAO's per-country GAUL 2025
# citation spreadsheet (verbose academic-style citations, one per country)
# down to just the attributed institution/dataset, matching the brevity of
# ocha.csv's provider text — no accessed-date/URL/licence boilerplate. No
# source_updated: the spreadsheet only gives FAO's access date, not a
# genuine per-country boundary update date.
RAW_DIR="scripts/data/provenance"
OUT_PARQUET="static/parquet/source_provenance.parquet"
OUT_CSV="static/parquet/source_provenance.csv"

mkdir -p static/parquet

duckdb -c "
  CREATE TEMP TABLE wfp_country AS
    SELECT iso3,
      array_to_string(list_distinct(list(source)), '; ') AS provider,
      max(lst_update) AS source_updated
    FROM read_parquet('static/parquet/wfp_adm1.parquet')
    GROUP BY iso3;

  -- WFP's lst_update is a mix of genuine per-country refresh dates and a
  -- one-time bulk database migration stamp shared by ~4/5 of all countries
  -- (e.g. 207/262 all read 2023-01-17, from a single seeding event, not a
  -- boundary change). Treating that value as a real update date would be
  -- dishonest, so it's nulled out here whenever one date dominates the
  -- column (computed dynamically, not hardcoded, so a future WFP download
  -- with a different baseline stamp — or none at all — is still handled).
  CREATE TEMP TABLE wfp_baseline AS
    SELECT source_updated AS baseline_date
    FROM wfp_country
    GROUP BY source_updated
    HAVING count(*) > 0.3 * (SELECT count(*) FROM wfp_country)
    ORDER BY count(*) DESC
    LIMIT 1;

  CREATE TABLE provenance AS
    SELECT 'ocha' AS source, iso3, provider, source_updated::DATE AS source_updated
    FROM read_csv('${RAW_DIR}/ocha.csv', header=true)
  UNION ALL
    SELECT 'fao' AS source, iso3, provider, NULL::DATE AS source_updated
    FROM read_csv('${RAW_DIR}/fao.csv', header=true)
  UNION ALL
    SELECT 'wfp' AS source, iso3, provider,
      CASE WHEN source_updated IN (SELECT baseline_date FROM wfp_baseline)
        THEN NULL ELSE source_updated END AS source_updated
    FROM wfp_country
  UNION ALL
    SELECT 'unhcr' AS source, iso3,
      array_to_string(list_distinct(list(source)), '; ') AS provider,
      max(src_date) AS source_updated
    FROM read_parquet('static/parquet/unhcr_adm1.parquet')
    GROUP BY iso3
  UNION ALL
    -- World Bank's GEOM_SRCE is consistent for every row of a given country
    -- (no country has more than one distinct value), and reveals real
    -- attribution: most countries read 'WB GAD' (digitized in-house), but
    -- some read 'UN SALB' or 'UN HDX' — i.e. WB sourced those from UNGIS or
    -- OCHA/HDX rather than digitizing them. No date field is available.
    SELECT 'wb' AS source, \"ISO_A3\" AS iso3, any_value(\"GEOM_SRCE\") AS provider,
      NULL::DATE AS source_updated
    FROM read_parquet('static/parquet/wb_adm1.parquet')
    GROUP BY \"ISO_A3\"
  UNION ALL
    -- UNGIS/SALB's datsor is a per-admin-unit source date (mostly D/M/YYYY,
    -- with some malformed values that try_strptime just turns into NULL).
    -- No separate provider text field exists — SALB is itself the
    -- standardized system, so provider is left blank here.
    SELECT 'salb' AS source, iso3cd AS iso3, NULL::VARCHAR AS provider,
      max(try_strptime(datsor, '%d/%m/%Y')::DATE) AS source_updated
    FROM read_parquet('static/parquet/salb_adm1.parquet')
    GROUP BY iso3cd;

  COPY provenance TO '${OUT_PARQUET}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15);
  COPY (SELECT * FROM provenance ORDER BY source, iso3) TO '${OUT_CSV}' (HEADER, DELIMITER ',');
"

echo "Wrote source provenance → ${OUT_PARQUET} and ${OUT_CSV}"
