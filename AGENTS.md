# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Commands

```sh
npm run download             # Download all data + compute plan status and comparison stats
npm run download:m49         # Scrape UN M49 table and write static/parquet/m49.parquet
npm run download:plan-status # Rank countries by humanitarian plan status (static/parquet/plan_status.parquet)
npm run download:iso3166     # Fetch ISO 3166-2 subdivision counts per country (static/parquet/iso3166.parquet)
npm run download:mapbox-boundaries # Fetch Mapbox Boundaries per-country/level admin unit counts (static/parquet/mapbox_boundaries.parquet)
npm run download:office-type # Fetch OCHA office type (CO/RO/HAT) per country from OCHA's PowerBI HOO dashboard (static/parquet/office_type.parquet)
npm run download:ocha        # Download OCHA boundaries via scripts/ocha.sh
npm run download:wfp         # Download WFP boundaries via scripts/wfp.sh
npm run download:unhcr       # Download UNHCR boundaries via scripts/unhcr.sh
npm run download:stats       # Compute per-source/level comparison stats (static/parquet/source_stats.parquet)
npm run download:provenance  # Build per-source provenance (provider, source-updated date) (static/parquet/source_provenance.parquet + .csv)
npm run download:comparison  # Flatten stats/provenance/match/reference counts + team decisions into one downloadable dataset (static/parquet/source_comparison.parquet + .csv)
npm run download:bbox        # Compute antimeridian-aware per-country fit bbox (static/parquet/country_bbox.parquet)

npm run sync         # Sync pmtiles + parquet to Cloudflare R2
```

There are no tests configured yet.

This repo builds the data and publishes it to R2 (`hdx-boundaries-explorer.fieldmaps.io`). The explorer app lives in [OCHA-DAP/cod-site](https://github.com/OCHA-DAP/cod-site) at `/explorer/`; `site/` here is a GitHub Pages redirect to it that keeps the query string and `#hash`.

## Data pipeline

New pipeline scripts are Python (stdlib `subprocess` calling `duckdb`/`gdal`, `uv run` with inline PEP 723 deps when an external package is needed). The `.sh` scripts are legacy, kept as-is rather than ported.

- `scripts/m49.py` — scrapes the UN M49 country table and writes `static/parquet/m49.parquet` (via a temp CSV + DuckDB)
- `scripts/plan_status.py` — fetches OCHA HPC Tools plan data (`api.hpc.tools/v2/public/plan`) for every year since 2000, ranks each country by best-ever plan type (HNRP > HRP > FA > REG > Other > none, mirroring `hdx-cod-ab-status`'s `woPlanTypeRank`), and writes `static/parquet/plan_status.parquet`. Must run after `download:m49`.
- `scripts/iso3166.py` — fetches Debian's `iso-codes` mirror of the ISO 3166-2 standard (`salsa.debian.org/iso-codes-team/iso-codes`, since `iso.org/obp` has no public API and blocks scraping), counts subdivision codes per country, and writes `static/parquet/iso3166.parquet` (iso3, iso2, subdivision_count). Must run after `download:m49` (joins on ISO-alpha2 Code). Deliberately fetches without a browser-like User-Agent header — Salsa's Anubis bot-check challenges spoofed browser UAs but passes a plain script-like one.
- `scripts/mapbox_boundaries.py` — fetches per-country, per-level admin unit counts from Mapbox's public Boundaries Explorer demo (`demos.mapbox.com/boundaries-explorer/lib/lookups/{iso2}/adm{level}.json`, a lookup JSON the demo itself loads client-side), since Mapbox Boundaries is a licensed dataset with no public bulk API. Writes `static/parquet/mapbox_boundaries.parquet` (iso3, iso2, level, feature_count). Must run after `download:m49` (joins on ISO-alpha2 Code). A 404 means that level doesn't exist for the country (not an error, so not retried); run via `uv run` with tenacity declared as an inline PEP 723 dependency, since this is one of two Python scripts here with an external dependency (the other is `office_type.py`)
- `scripts/office_type.py` — ported from `hdx-cod-ab-status`'s `scripts/offices.py`. Classifies each country as `CO`/`HAT`/`RO` by querying OCHA's PowerBI HOO contact-list dashboard (`querydata` REST call, hand-decoded DSR rows), resolves names to ISO3 via `m49.parquet`. Writes `static/parquet/office_type.parquet` (iso3, office_type); only countries with an office get a row. Must run after `download:m49`; run via `uv run` (requests as inline PEP 723 dep)
- `scripts/comparison.py` joins `source_stats.parquet`, `source_provenance.parquet`, `iso3166.parquet`, `mapbox_boundaries.parquet`, `source_match.parquet`, `m49.parquet`, and the decisions sheet (if `VITE_DECISIONS_SHEET_URL` is set) into one row per `(iso3, source, level)`, for partners who want the full comparison dataset outside the app. Writes `static/parquet/source_comparison.parquet` and `.csv`. Must run after `download:m49`, `download:iso3166`, `download:mapbox-boundaries`, `download:provenance`, `download:stats`, and `download:match`; run via `uv run` (duckdb as inline PEP 723 dep). The match-rate join additionally requires `match.preferred_source` to equal the decision's current `selected_source`, so a match row computed against a since-changed sheet decision is left blank rather than shown as current.
- `scripts/ocha.sh` — downloads OCHA boundaries (admin levels 1–4) from GDB, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/wfp.sh` — downloads WFP boundary parquet files, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/unhcr.sh` — downloads UNHCR boundaries (admin levels 1–2) from ESRI JSON, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/stats.sh` — computes per-source/per-level comparison stats (feature counts, vertex counts via DuckDB spatial `ST_NPoints`) from the already-downloaded boundary parquet files, writing `static/parquet/source_stats.parquet`. Must run last, after every `download:<source>` script.
- `scripts/bbox.sh` — computes each country's map-fit bbox from `static/parquet/salb_adm0.parquet`, writing `static/parquet/country_bbox.parquet` (iso3, xmin, ymin, xmax, ymax). Must run after `download:salb`. GDAL's GeoParquet covering bbox column (a plain min/max of every vertex's longitude) is wrong for a country with territory near the antimeridian — e.g. NZL's mainland (~~166–179°E) plus Chatham Islands (~~-176°) naively covers -178 to 179, which `map.fitBounds` reads literally as a box spanning the "wrong way" around the globe (357° wide) instead of the ~18° that actually contains the country. The fix: dump every vertex's longitude, sort them, and find the largest gap in that circular sequence — the empty arc with no vertices in it — then take the bbox as the complement of that gap, unwrapped past 180 if needed (so `xmax` can legitimately exceed 180, e.g. Russia's ~19.6°E to ~191°/-169°). This also degrades correctly for ordinary countries, since the largest gap is just the ordinary wrap-around one, giving the usual min/max — no special-casing needed.
- `scripts/provenance.sh` — normalizes per-source provenance (data provider, date the source was last updated) into `static/parquet/source_provenance.parquet`, plus a `.csv` copy synced alongside it to R2 so contributors can download it to see the schema for their next submission. OCHA and FAO have no provenance fields in their boundary layers, so they come from raw CSVs committed under `scripts/data/provenance/` — hand-replaced whenever an updated snapshot arrives (OCHA: from an OCHA contact; FAO: condensed from FAO's per-country GAUL citation spreadsheet down to a short provider phrase, matching `ocha.csv`'s brevity — no accessed-date/URL/licence text, and no `source_updated` since the spreadsheet only gives FAO's access date, not a genuine boundary update date), each arriving in a different shape, so those branches of `provenance.sh` may need adjusting per submission. WFP and UNHCR carry provenance directly in their downloaded boundary layers — richer and more current than any hand-compiled snapshot of them — so those are read straight from `static/parquet/*.parquet` instead (`source`+`lst_update`/`src_date`), meaning `provenance.sh` must run after every `download:<source>` script. WFP's per-country update date is additionally checked for a dominant bulk-migration timestamp (one date shared by most countries, from a one-time DB seeding rather than a real boundary change) and nulled out rather than shown as if it were genuine. UNICEF has no usable provenance field in its layer
- All boundary-download scripts use `gdal vector pipeline` with `make-valid`, `reproject`, and `set-field-type` steps before writing
- Label PMTiles use `--drop-rate=1` and `--no-feature-limit` to preserve all label points
- Parquet and PMTiles files are synced to Cloudflare R2 via `npm run sync`
- Admin levels go up to 4 across all sources (OCHA, WFP, UNICEF); UNHCR and FAO go up to 2. SALB is built at adm0 + lines only (country outlines and `country_bbox.parquet`); World Bank is not built

## Decision tracking (Google Sheet)

- `scripts/match.py` and `scripts/comparison.py` **read but never write** a team-maintained Google Sheet of per-country boundary-source decisions; contributors edit the sheet directly. Re-run `download:match` and `download:comparison` (then `sync`) after `selected_source` changes.
- Configure via `VITE_DECISIONS_SHEET_URL`, a "File → Share → Publish to web" CSV URL for the decisions tab (see `.env.example`). If unset, `comparison.py` writes its output without decisions.
- Expected columns (case-insensitive): `iso3`, `country_name` (human aid, not read programmatically), `selected_source` (one of the lowercase source ids in `scripts/stats.sh`'s `SOURCES`, blank, or the literal text `null` — see below), `accepted` (boolean — literal `TRUE`/`FALSE` as exported by a Google Sheets checkbox cell; blank or anything else parses as `false`, meaning no decision yet), `rationale` (free text), `last_updated` (free text, displayed verbatim).
- A `selected_source` cell containing the literal text `null` is a deliberate "none of our sources are suitable" call, distinct from a blank cell (no decision made yet).

## Evaluating which source is most accurate for a country

When asked "which source is most accurate for country X" (or to explain a feature-count mismatch), run this sequence instead of exploring from scratch:

1. **Feature counts**: `SELECT * FROM 'static/parquet/source_stats.parquet' WHERE iso3='XXX' ORDER BY source, level` — the first signal; divergent counts across sources at the same level are the thing to explain.
2. **Ground-truth anchor**: `SELECT * FROM 'static/parquet/iso3166.parquet' WHERE iso3='XXX'` — `subdivision_count` approximates the official top-tier count (ISO 3166-2). Not exact for every country (e.g. it includes/excludes autonomous entities like Greece's Mount Athos), but a fast sanity check.
3. **Provenance**: `SELECT * FROM 'static/parquet/source_provenance.parquet' WHERE iso3='XXX'` — provider + `source_updated` date, a first clue toward staleness.
4. **Pull actual admin-unit names** per source at the level(s) that diverge, then diff them with SQL `EXCEPT` to classify the difference. Per-source name/filter columns (file is `static/parquet/{source}_adm{N}.parquet`):
   - `wfp`: filter `iso3='XXX'`, name is `adm{N}_name`
   - `unicef`: filter `adm0_ucode LIKE 'XXX%'` (no direct iso3 column), name is `name`
   - `unhcr`: filter `iso3='XXX'`, name is `gis_name` (pcode in `pcode`)
   - `fao`: filter `ISO3_CODE='XXX'`, name is `GAUL{N}_NAME`
   - A diff typically resolves into: (a) harmless spelling/transliteration variants (e.g. `ts`/`c`, diacritics) — pair them off and ignore; (b) genuine extra/missing units — look for junk placeholder rows (`N_A`, `Name Unknown`, `Under National Administration`, a row repeating the country's own name) that inflate a count without being real subdivisions; (c) a tier mismatch — one source's adm1 count is suspiciously close to another source's adm2 count, meaning it's using a coarser/finer official tier, not a wrong dataset (confirm by comparing name lists across tiers, not just counts).
5. **Web-search the country's actual official administrative structure** (region/province count, municipality count, and any reform dates) — reforms that merge or split units are the most common cause of a source being "stale": check whether a source still lists old constituent units separately instead of the current merged unit.
6. If staleness is suspected (old sub-units alongside a new merged unit), confirm with DuckDB spatial rather than guessing: `LOAD spatial; SELECT name, ST_Area(geometry) FROM ... WHERE name IN (...)` — the merged unit's area should be small relative to the old sub-units it was supposed to absorb if the source never actually merged them (as opposed to overlapping/duplicate geometry, which would show the merged unit's area roughly equal to the sum of the parts).
7. **Check the decisions sheet** for whether the team already made a call: `curl -s "$(grep VITE_DECISIONS_SHEET_URL .env | cut -d= -f2-)" | grep -i "^XXX,\|,XXX,"`.

