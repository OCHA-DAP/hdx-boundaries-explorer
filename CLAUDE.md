# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Commands

```sh
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Type-check with svelte-check
npm run lint         # Check formatting (prettier) and lint (eslint)
npm run format       # Auto-format with prettier

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
npm run download:basemap     # Vendor OpenFreeMap's positron style, stripped of boundary layers (src/lib/map/basemap/positron.json)
npm run download:provenance  # Build per-source provenance (provider, source-updated date) (static/parquet/source_provenance.parquet + .csv)
npm run download:bbox        # Compute antimeridian-aware per-country fit bbox (static/parquet/country_bbox.parquet)

npm run sync         # Sync pmtiles + parquet to Cloudflare R2
```

There are no tests configured yet.

## Architecture

**SvelteKit + TypeScript** app using **Svelte 5** (runes syntax: `$props()`, `$state()`, etc.) and **MapLibre GL** for interactive mapping.

- `src/routes/+page.svelte` — the single-page app: a fixed-width `CountrySidebar` on the left (country nav list), the map filling the rest, and a bottom-docked `StatsPanel` comparison drawer overlaid on the map (which embeds the labels toggle for whichever country is selected). The selected country is driven by a `?country=ISO3` query param rather than a dynamic route segment (avoids prerendering one static page per country under `adapter-static`)
- `src/lib/` — shared components and utilities, importable via `$lib/` alias
- `src/lib/components/` — UI components (CountrySidebar — the left nav, shows each country's team decision and OCHA office type (CO/RO/HAT, via OfficeTypeBadge) inline as tags and handles `[`/`]` source-cycling — plus RelevanceBadge, OfficeTypeBadge, LabelsToggle, StatsPanel/StatsComparisonTable). There is no dedicated source/admin-level dropdown; picking a source or level happens by clicking a row/cell in StatsComparisonTable
- `src/lib/map/` — MapLibre initialisation, layers, interactions, store. `src/lib/map/admin.ts` exports `selectCountry(map, iso3)`, the shared "pick a country" sequence used by both `CountrySidebar`'s row clicks and the page's initial query-param handling, and `selectSource`/`selectSourceLevel` for switching source/level (both resolve to a level that actually has data for the current country, via `source_stats.parquet`); it also exports `fitCountryBounds(map, iso3)`, reused by a `map.on("resize", ...)` listener (wired in `src/lib/map/index.ts`) so the camera re-fits if the map's container is resized after a country is already selected. `fitCountryBounds` reads its bbox from `static/parquet/country_bbox.parquet` (via `src/lib/parquet/bbox.ts`) rather than SALB's raw GeoParquet covering bbox column — see `scripts/bbox.sh` for why (antimeridian-crossing countries like NZL/FJI/RUS need a wraparound-aware bbox, or the camera fits to a box spanning most of the globe instead of the country)
- `src/lib/map/basemap/positron.json` — a vendored, committed copy of OpenFreeMap's `positron` style (see `scripts/basemap.sh`), with all `source-layer: "boundary"` layers (international, subnational, disputed) stripped out so they don't compete with this app's own boundary overlays. `src/lib/map/style.ts` merges its `sources`/`layers`/`sprite`/`glyphs` in as the base map, with `countries`/`country-lines`/per-source admin layers stacked on top. Re-run `npm run download:basemap` to refresh it from upstream (OpenFreeMap's style has proven fairly stable — a handful of commits a year post-launch, per repo history)
- `src/lib/parquet/` — client-side helpers for querying parquet files with `hyparquet` (a pure-JS reader; there is no DuckDB-WASM/SQL engine in the browser — aggregate values like vertex counts are precomputed at data-build time instead, see Data pipeline)
- `src/lib/sheet/` — reads the team's boundary-decision Google Sheet (published-to-web CSV, read-only) via a hand-rolled RFC4180 `parseCsv` and `decisions.ts`
- `src/lib/sources.ts` — defines the 7 available boundary sources (OCHA, WFP, UNICEF, UNHCR, SALB, FAO, World Bank) and their admin levels
- `static/` — assets served as-is; parquet and pmtiles files live here (not committed)

The project is an explorer for HDX (Humanitarian Data Exchange) geographic boundaries, and a decision-support tool for choosing which source to use per country. MapLibre GL (`maplibre-gl`) is the primary mapping library. Data is served from pre-built PMTiles (vector tiles) and Parquet files queried client-side.

Uses `adapter-static` (fully static site, deployed to GitHub Pages; `paths.base` is set to `/hdx-boundaries-explorer` in production only — see `svelte.config.js`). There is no backend/server route of any kind.

## Data pipeline

- `scripts/m49.py` — scrapes the UN M49 country table and writes `static/parquet/m49.parquet` (via a temp CSV + DuckDB)
- `scripts/plan_status.py` — fetches OCHA HPC Tools plan data (`api.hpc.tools/v2/public/plan`) for every year since 2000, ranks each country by best-ever plan type (HNRP > HRP > FA > REG > Other > none, mirroring `hdx-cod-ab-status`'s `woPlanTypeRank`), and writes `static/parquet/plan_status.parquet`. Must run after `download:m49`.
- `scripts/iso3166.py` — fetches Debian's `iso-codes` mirror of the ISO 3166-2 standard (`salsa.debian.org/iso-codes-team/iso-codes`, since `iso.org/obp` has no public API and blocks scraping), counts subdivision codes per country, and writes `static/parquet/iso3166.parquet` (iso3, iso2, subdivision_count). Must run after `download:m49` (joins on ISO-alpha2 Code). Deliberately fetches without a browser-like User-Agent header — Salsa's Anubis bot-check challenges spoofed browser UAs but passes a plain script-like one. Surfaced in `StatsComparisonTable` next to the "Adm 1" row label as a reference count, linking out to the matching `iso.org/obp` page.
- `scripts/mapbox_boundaries.py` — fetches per-country, per-level admin unit counts from Mapbox's public Boundaries Explorer demo (`demos.mapbox.com/boundaries-explorer/lib/lookups/{iso2}/adm{level}.json`, a lookup JSON the demo itself loads client-side), since Mapbox Boundaries is a licensed dataset with no public bulk API. Writes `static/parquet/mapbox_boundaries.parquet` (iso3, iso2, level, feature_count). Must run after `download:m49` (joins on ISO-alpha2 Code). A 404 means that level doesn't exist for the country (not an error, so not retried); run via `uv run` with tenacity declared as an inline PEP 723 dependency, since this is one of two Python scripts here with an external dependency (the other is `office_type.py`)
- `scripts/office_type.py` — ported from `hdx-cod-ab-status`'s `scripts/offices.py`. Classifies each country as `CO`/`HAT`/`RO` by querying OCHA's PowerBI HOO contact-list dashboard (`querydata` REST call, hand-decoded DSR rows), resolves names to ISO3 via `m49.parquet`. Writes `static/parquet/office_type.parquet` (iso3, office_type); only countries with an office get a row. Must run after `download:m49`; run via `uv run` (requests as inline PEP 723 dep). Surfaced in `CountrySidebar` via `OfficeTypeBadge`
- `scripts/ocha.sh` — downloads OCHA boundaries (admin levels 1–4) from GDB, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/wfp.sh` — downloads WFP boundary parquet files, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/unhcr.sh` — downloads UNHCR boundaries (admin levels 1–2) from ESRI JSON, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/stats.sh` — computes per-source/per-level comparison stats (feature counts, vertex counts via DuckDB spatial `ST_NPoints`) from the already-downloaded boundary parquet files, writing `static/parquet/source_stats.parquet`. Must run last, after every `download:<source>` script.
- `scripts/bbox.sh` — computes each country's map-fit bbox from `static/parquet/salb_adm0.parquet`, writing `static/parquet/country_bbox.parquet` (iso3, xmin, ymin, xmax, ymax). Must run after `download:salb`. GDAL's GeoParquet covering bbox column (a plain min/max of every vertex's longitude) is wrong for a country with territory near the antimeridian — e.g. NZL's mainland (~~166–179°E) plus Chatham Islands (~~-176°) naively covers -178 to 179, which `map.fitBounds` reads literally as a box spanning the "wrong way" around the globe (357° wide) instead of the ~18° that actually contains the country. The fix: dump every vertex's longitude, sort them, and find the largest gap in that circular sequence — the empty arc with no vertices in it — then take the bbox as the complement of that gap, unwrapped past 180 if needed (so `xmax` can legitimately exceed 180, e.g. Russia's ~19.6°E to ~191°/-169°). This also degrades correctly for ordinary countries, since the largest gap is just the ordinary wrap-around one, giving the usual min/max — no special-casing needed. `src/lib/parquet/bbox.ts`'s `getBboxForIso3` reads this file (not SALB's raw covering bbox), and `fitCountryBounds` (`src/lib/map/admin.ts`) passes its xmin/xmax straight to `map.fitBounds` without re-normalizing
- `scripts/basemap.sh` — fetches OpenFreeMap's `positron` style JSON, strips layers with `source-layer: "boundary"` via `jq`, and writes the committed `src/lib/map/basemap/positron.json` (not gitignored, unlike the other pipeline outputs — it's small and meant to be reviewed/diffed like source)
- `scripts/provenance.sh` — normalizes per-source provenance (data provider, date the source was last updated) into `static/parquet/source_provenance.parquet`, plus a `.csv` copy synced alongside it to R2 so contributors can download it to see the schema for their next submission. OCHA and FAO have no provenance fields in their boundary layers, so they come from raw CSVs committed under `scripts/data/provenance/` — hand-replaced whenever an updated snapshot arrives (OCHA: from an OCHA contact; FAO: condensed from FAO's per-country GAUL citation spreadsheet down to a short provider phrase, matching `ocha.csv`'s brevity — no accessed-date/URL/licence text, and no `source_updated` since the spreadsheet only gives FAO's access date, not a genuine boundary update date), each arriving in a different shape, so those branches of `provenance.sh` may need adjusting per submission. WFP, UNHCR, World Bank, and UNGIS/SALB all carry provenance directly in their downloaded boundary layers — richer and more current than any hand-compiled snapshot of them — so those are read straight from `static/parquet/*.parquet` instead (WFP/UNHCR: `source`+`lst_update`/`src_date`; World Bank: `GEOM_SRCE`, provider only, no date; UNGIS/SALB: `datsor`, date only, no separate provider text), meaning `provenance.sh` must run after every `download:<source>` script. WFP's per-country update date is additionally checked for a dominant bulk-migration timestamp (one date shared by most countries, from a one-time DB seeding rather than a real boundary change) and nulled out rather than shown as if it were genuine. UNICEF has no usable provenance field in its layer
- All boundary-download scripts use `gdal vector pipeline` with `make-valid`, `reproject`, and `set-field-type` steps before writing
- Label PMTiles use `--drop-rate=1` and `--no-feature-limit` to preserve all label points
- Parquet and PMTiles files are synced to Cloudflare R2 via `npm run sync`
- Admin levels go up to 4 across all sources (OCHA, WFP, UNICEF); UNHCR, UNGIS/SALB, FAO and World Bank go up to 2

## Decision tracking (Google Sheet)

- The app **reads but never writes** a team-maintained Google Sheet of per-country boundary-source decisions — contributors edit the sheet directly, outside the app.
- Configure via `VITE_DECISIONS_SHEET_URL`, a "File → Share → Publish to web" CSV URL for the decisions tab (see `.env.example`). If unset, decision UI shows empty/default state.
- Expected columns (case-insensitive): `iso3`, `country_name` (human aid, not read programmatically), `selected_source` (one of the lowercase ids in `ADMIN_SOURCES`, blank, or the literal text `null` — see below), `accepted` (boolean — literal `TRUE`/`FALSE` as exported by a Google Sheets checkbox cell; blank or anything else parses as `false`, meaning no decision yet), `rationale` (free text), `last_updated` (free text, displayed verbatim).
- A `selected_source` cell containing the literal text `null` is a deliberate "none of our sources are suitable" call, distinct from a blank cell (no decision made yet) — `decisions.ts` surfaces this as `Decision.noSourceSuitable`, which `CountrySidebar` renders as a "None suitable" tag instead of the usual Accepted/Pending + source tag.
- In `CountrySidebar`'s country list, a country only gets a decision tag when `accepted` is `true`, it has a `selected_source` set, or `noSourceSuitable` is true — untouched rows stay untagged so the list scans cleanly.
- `src/lib/sheet/decisions.ts` fetches with `{ cache: "no-store" }` and memoizes the parsed result for the page's lifetime (a reload picks up sheet edits — the team doesn't edit it often enough to need anything finer-grained) — `CountrySidebar`, `StatsPanel`, and `StatsComparisonTable` each call `getDecisions()`/`getDecisionForIso3()` independently, and without this cache every country click re-fetched the whole CSV from scratch, visible as lag before the "team's pick" checkmark rendered. A fetch failure (offline, CORS misconfiguration, sheet unpublished) degrades to an empty result rather than throwing.

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
   - `wb`: filter `ISO_A3='XXX'`, name is `NAM_{N}`
   - `salb`: filter `iso3cd='XXX'`, name is `adm{N}nm` — **gotcha**: `romnam` is the constant country name, not the admin-unit name; don't mistake it for the unit label (it'll look like a single "unit" per country if you do)
   - A diff typically resolves into: (a) harmless spelling/transliteration variants (e.g. `ts`/`c`, diacritics) — pair them off and ignore; (b) genuine extra/missing units — look for junk placeholder rows (`N_A`, `Name Unknown`, `Under National Administration`, a row repeating the country's own name) that inflate a count without being real subdivisions; (c) a tier mismatch — one source's adm1 count is suspiciously close to another source's adm2 count, meaning it's using a coarser/finer official tier, not a wrong dataset (confirm by comparing name lists across tiers, not just counts).
5. **Web-search the country's actual official administrative structure** (region/province count, municipality count, and any reform dates) — reforms that merge or split units are the most common cause of a source being "stale": check whether a source still lists old constituent units separately instead of the current merged unit.
6. If staleness is suspected (old sub-units alongside a new merged unit), confirm with DuckDB spatial rather than guessing: `LOAD spatial; SELECT name, ST_Area(geometry) FROM ... WHERE name IN (...)` — the merged unit's area should be small relative to the old sub-units it was supposed to absorb if the source never actually merged them (as opposed to overlapping/duplicate geometry, which would show the merged unit's area roughly equal to the sum of the parts).
7. **Check the decisions sheet** for whether the team already made a call: `curl -s "$(grep VITE_DECISIONS_SHEET_URL .env | cut -d= -f2-)" | grep -i "^XXX,\|,XXX,"`.

## UI conventions

- Each dropdown is wrapped in a `<div class="field">` with `display: flex; flex-direction: column; gap: 4px` so the label sits tight above its select
- Tooltips use CSS (`::hover` on a nested `.tooltip` span) rather than the `title` attribute for cross-browser reliability
- `[` / `]` keyboard shortcuts cycle through boundary sources (handled in `CountrySidebar.svelte`) — this remains the map's visual comparison mechanism; the stats comparison panel (`StatsPanel`/`StatsComparisonTable`) is a tabular comparison, not a simultaneous multi-source map overlay (deliberately not implemented, to avoid visual noise). Clicking a source row or source/level cell in `StatsComparisonTable` is the other way to switch what's shown on the map
