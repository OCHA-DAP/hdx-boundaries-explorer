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
npm run download:ocha        # Download OCHA boundaries via scripts/ocha.sh
npm run download:wfp         # Download WFP boundaries via scripts/wfp.sh
npm run download:unhcr       # Download UNHCR boundaries via scripts/unhcr.sh
npm run download:stats       # Compute per-source/level comparison stats (static/parquet/source_stats.parquet)

npm run sync         # Sync pmtiles + parquet to Cloudflare R2
```

There are no tests configured yet.

## Architecture

**SvelteKit + TypeScript** app using **Svelte 5** (runes syntax: `$props()`, `$state()`, etc.) and **MapLibre GL** for interactive mapping.

- `src/routes/+page.svelte` — the single-page app: a fixed-width `CountrySidebar` on the left (country nav list, plus the labels toggle and decision panel for whichever country is selected), the map filling the rest, and a bottom-docked `StatsPanel` comparison drawer overlaid on the map. The selected country is driven by a `?country=ISO3` query param rather than a dynamic route segment (avoids prerendering one static page per country under `adapter-static`)
- `src/lib/` — shared components and utilities, importable via `$lib/` alias
- `src/lib/components/` — UI components (CountrySidebar — the left nav, embeds LabelsToggle/DecisionPanel for the selected country and handles `[`/`]` source-cycling — plus RelevanceBadge, StatsPanel/StatsComparisonTable). There is no dedicated source/admin-level dropdown; picking a source or level happens by clicking a row/cell in StatsComparisonTable
- `src/lib/map/` — MapLibre initialisation, layers, interactions, store. `src/lib/map/admin.ts` exports `selectCountry(map, iso3)`, the shared "pick a country" sequence used by both `CountrySidebar`'s row clicks and the page's initial query-param handling, and `selectSource`/`selectSourceLevel` for switching source/level (both resolve to a level that actually has data for the current country, via `source_stats.parquet`)
- `src/lib/parquet/` — client-side helpers for querying parquet files with `hyparquet` (a pure-JS reader; there is no DuckDB-WASM/SQL engine in the browser — aggregate values like vertex counts are precomputed at data-build time instead, see Data pipeline)
- `src/lib/sheet/` — reads the team's boundary-decision Google Sheet (published-to-web CSV, read-only) via a hand-rolled RFC4180 `parseCsv` and `decisions.ts`
- `src/lib/sources.ts` — defines the 7 available boundary sources (OCHA, WFP, UNICEF, UNHCR, UNGIS/SALB, FAO, World Bank) and their admin levels
- `static/` — assets served as-is; parquet and pmtiles files live here (not committed)

The project is an explorer for HDX (Humanitarian Data Exchange) geographic boundaries, and a decision-support tool for choosing which source to use per country. MapLibre GL (`maplibre-gl`) is the primary mapping library. Data is served from pre-built PMTiles (vector tiles) and Parquet files queried client-side.

Uses `adapter-static` (fully static site, deployed to GitHub Pages; `paths.base` is set to `/hdx-boundaries-explorer` in production only — see `svelte.config.js`). There is no backend/server route of any kind.

## Data pipeline

- `scripts/m49.py` — scrapes the UN M49 country table and writes `static/parquet/m49.parquet` (via a temp CSV + DuckDB)
- `scripts/plan_status.py` — fetches OCHA HPC Tools plan data (`api.hpc.tools/v2/public/plan`) for every year since 2000, ranks each country by best-ever plan type (HNRP > HRP > FA > REG > Other > none, mirroring `hdx-cod-ab-status`'s `woPlanTypeRank`), and writes `static/parquet/plan_status.parquet`. Must run after `download:m49`.
- `scripts/ocha.sh` — downloads OCHA boundaries (admin levels 1–4) from GDB, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/wfp.sh` — downloads WFP boundary parquet files, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/unhcr.sh` — downloads UNHCR boundaries (admin levels 1–2) from ESRI JSON, reprojects to EPSG:4326, writes parquet + PMTiles
- `scripts/stats.sh` — computes per-source/per-level comparison stats (feature counts, vertex counts via DuckDB spatial `ST_NPoints`) from the already-downloaded boundary parquet files, writing `static/parquet/source_stats.parquet`. Must run last, after every `download:<source>` script.
- All boundary-download scripts use `gdal vector pipeline` with `make-valid`, `reproject`, and `set-field-type` steps before writing
- Label PMTiles use `--drop-rate=1` and `--no-feature-limit` to preserve all label points
- Parquet and PMTiles files are synced to Cloudflare R2 via `npm run sync`
- Admin levels go up to 4 across all sources (OCHA, WFP, UNICEF); UNHCR, UNGIS/SALB, FAO and World Bank go up to 2

## Decision tracking (Google Sheet)

- The app **reads but never writes** a team-maintained Google Sheet of per-country boundary-source decisions — contributors edit the sheet directly, outside the app.
- Configure via `VITE_DECISIONS_SHEET_URL`, a "File → Share → Publish to web" CSV URL for the decisions tab (see `.env.example`). If unset, decision UI shows empty/default state.
- Expected columns (case-insensitive): `iso3`, `country_name` (human aid, not read programmatically), `selected_source` (one of the lowercase ids in `ADMIN_SOURCES`, or blank), `status` (`No opinion` / `Undecided (option in mind)` / `Unanimous decision`), `rationale` (free text), `last_updated` (free text, displayed verbatim).
- `src/lib/sheet/decisions.ts` fetches with `{ cache: "no-store" }` and does **not** memoize across the app's lifetime, since the sheet changes outside of a deploy — `CountrySidebar` and `DecisionPanel` each fetch their own copy on mount. A fetch failure (offline, CORS misconfiguration, sheet unpublished) degrades to an empty result rather than throwing.

## UI conventions

- Each dropdown is wrapped in a `<div class="field">` with `display: flex; flex-direction: column; gap: 4px` so the label sits tight above its select
- Tooltips use CSS (`::hover` on a nested `.tooltip` span) rather than the `title` attribute for cross-browser reliability
- `[` / `]` keyboard shortcuts cycle through boundary sources (handled in `CountrySidebar.svelte`) — this remains the map's visual comparison mechanism; the stats comparison panel (`StatsPanel`/`StatsComparisonTable`) is a tabular comparison, not a simultaneous multi-source map overlay (deliberately not implemented, to avoid visual noise). Clicking a source row or source/level cell in `StatsComparisonTable` is the other way to switch what's shown on the map
