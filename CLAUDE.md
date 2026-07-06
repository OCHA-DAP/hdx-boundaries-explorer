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
npm run download:ocha        # Download OCHA boundaries via scripts/ocha.sh
npm run download:wfp         # Download WFP boundaries via scripts/wfp.sh
npm run download:unhcr       # Download UNHCR boundaries via scripts/unhcr.sh
npm run download:stats       # Compute per-source/level comparison stats (static/parquet/source_stats.parquet)
npm run download:basemap     # Vendor OpenFreeMap's positron style, stripped of boundary layers (src/lib/map/basemap/positron.json)
npm run download:provenance  # Build per-source provenance (provider, source-updated date) (static/parquet/source_provenance.parquet + .csv)

npm run sync         # Sync pmtiles + parquet to Cloudflare R2
```

There are no tests configured yet.

## Architecture

**SvelteKit + TypeScript** app using **Svelte 5** (runes syntax: `$props()`, `$state()`, etc.) and **MapLibre GL** for interactive mapping.

- `src/routes/+page.svelte` — the single-page app: a fixed-width `CountrySidebar` on the left (country nav list), the map filling the rest, and a bottom-docked `StatsPanel` comparison drawer overlaid on the map (which embeds the labels toggle for whichever country is selected). The selected country is driven by a `?country=ISO3` query param rather than a dynamic route segment (avoids prerendering one static page per country under `adapter-static`)
- `src/lib/` — shared components and utilities, importable via `$lib/` alias
- `src/lib/components/` — UI components (CountrySidebar — the left nav, shows each country's team decision inline as a tag and handles `[`/`]` source-cycling — plus RelevanceBadge, LabelsToggle, StatsPanel/StatsComparisonTable). There is no dedicated source/admin-level dropdown; picking a source or level happens by clicking a row/cell in StatsComparisonTable
- `src/lib/map/` — MapLibre initialisation, layers, interactions, store. `src/lib/map/admin.ts` exports `selectCountry(map, iso3)`, the shared "pick a country" sequence used by both `CountrySidebar`'s row clicks and the page's initial query-param handling, and `selectSource`/`selectSourceLevel` for switching source/level (both resolve to a level that actually has data for the current country, via `source_stats.parquet`); it also exports `fitCountryBounds(map, iso3)`, reused by a `map.on("resize", ...)` listener (wired in `src/lib/map/index.ts`) so the camera re-fits if the map's container is resized after a country is already selected
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
- `scripts/mapbox_boundaries.py` — fetches per-country, per-level admin unit counts from Mapbox's public Boundaries Explorer demo (`demos.mapbox.com/boundaries-explorer/lib/lookups/{iso2}/adm{level}.json`, a lookup JSON the demo itself loads client-side), since Mapbox Boundaries is a licensed dataset with no public bulk API. Writes `static/parquet/mapbox_boundaries.parquet` (iso3, iso2, level, feature_count). Must run after `download:m49` (joins on ISO-alpha2 Code). A 404 means that level doesn't exist for the country (not an error, so not retried); run via `uv run` with tenacity declared as an inline PEP 723 dependency, since this is the only Python script here with an external dependency. Surfaced in `StatsComparisonTable` as a compact leftmost "Mapbox" column (no vertex counts, since Mapbox doesn't expose those) — the "Mapbox" label in the Source row links to the country overview, and each Adm N cell links to that level directly via `?country={iso2}&layer=adm{level}`
- `scripts/ocha.sh` — downloads OCHA boundaries (admin levels 1–4) from GDB, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/wfp.sh` — downloads WFP boundary parquet files, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/unhcr.sh` — downloads UNHCR boundaries (admin levels 1–2) from ESRI JSON, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/stats.sh` — computes per-source/per-level comparison stats (feature counts, vertex counts via DuckDB spatial `ST_NPoints`) from the already-downloaded boundary parquet files, writing `static/parquet/source_stats.parquet`. Must run last, after every `download:<source>` script.
- `scripts/basemap.sh` — fetches OpenFreeMap's `positron` style JSON, strips layers with `source-layer: "boundary"` via `jq`, and writes the committed `src/lib/map/basemap/positron.json` (not gitignored, unlike the other pipeline outputs — it's small and meant to be reviewed/diffed like source)
- `scripts/provenance.sh` — normalizes per-source provenance (data provider, date the source was last updated) into `static/parquet/source_provenance.parquet`, plus a `.csv` copy synced alongside it to R2 so contributors can download it to see the schema for their next submission. OCHA has no provenance fields in its boundary layer, so it comes from a raw CSV committed under `scripts/data/provenance/` — hand-replaced whenever an OCHA contact sends an updated snapshot, which may arrive in a different shape each time, so that branch of `provenance.sh` may need adjusting per submission. WFP, UNHCR, World Bank, and UNGIS/SALB all carry provenance directly in their downloaded boundary layers — richer and more current than any hand-compiled snapshot of them — so those are read straight from `static/parquet/*.parquet` instead (WFP/UNHCR: `source`+`lst_update`/`src_date`; World Bank: `GEOM_SRCE`, provider only, no date; UNGIS/SALB: `datsor`, date only, no separate provider text), meaning `provenance.sh` must run after every `download:<source>` script. WFP's per-country update date is additionally checked for a dominant bulk-migration timestamp (one date shared by most countries, from a one-time DB seeding rather than a real boundary change) and nulled out rather than shown as if it were genuine. UNICEF and FAO have no usable provenance field in their layers
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
- `src/lib/sheet/decisions.ts` fetches with `{ cache: "no-store" }` and does **not** memoize across the app's lifetime, since the sheet changes outside of a deploy — `CountrySidebar` fetches its own copy on mount. A fetch failure (offline, CORS misconfiguration, sheet unpublished) degrades to an empty result rather than throwing.

## UI conventions

- Each dropdown is wrapped in a `<div class="field">` with `display: flex; flex-direction: column; gap: 4px` so the label sits tight above its select
- Tooltips use CSS (`::hover` on a nested `.tooltip` span) rather than the `title` attribute for cross-browser reliability
- `[` / `]` keyboard shortcuts cycle through boundary sources (handled in `CountrySidebar.svelte`) — this remains the map's visual comparison mechanism; the stats comparison panel (`StatsPanel`/`StatsComparisonTable`) is a tabular comparison, not a simultaneous multi-source map overlay (deliberately not implemented, to avoid visual noise). Clicking a source row or source/level cell in `StatsComparisonTable` is the other way to switch what's shown on the map
