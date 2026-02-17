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

npm run download     # Download all data (WFP boundaries + M49 parquet)
npm run download:wfp # Download WFP boundaries via scripts/wfp.sh
npm run download:m49 # Scrape UN M49 table and write static/parquet/m49.parquet

npm run sync         # Sync pmtiles + parquet to Cloudflare R2
```

There are no tests configured yet.

## Architecture

**SvelteKit + TypeScript** app using **Svelte 5** (runes syntax: `$props()`, `$state()`, etc.) and **MapLibre GL** for interactive mapping.

- `src/routes/` — file-based routing; `+page.svelte` is a page, `+layout.svelte` wraps all pages
- `src/lib/` — shared components and utilities, importable via `$lib/` alias
- `src/lib/components/` — UI components (CountrySelect, SourceSelect, AdminSelect, Panel)
- `src/lib/map/` — MapLibre initialisation, layers, interactions, store
- `src/lib/parquet/` — DuckDB-WASM helpers for querying parquet files
- `src/lib/sources.ts` — defines available boundary sources (OCHA, WFP, UNHCR) and their admin levels
- `static/` — assets served as-is; parquet and pmtiles files live here (not committed)

The project is an explorer for HDX (Humanitarian Data Exchange) geographic boundaries. MapLibre GL (`maplibre-gl`) is the primary mapping library. Data is served from pre-built PMTiles (vector tiles) and Parquet files queried client-side via DuckDB-WASM.

Uses `adapter-auto` which detects the deployment target; may need replacing with a specific adapter (e.g., `adapter-static`) for deployment.

## Data pipeline

- `scripts/wfp.sh` — downloads WFP boundary PMTiles
- `scripts/m49.py` — scrapes the UN M49 country table and writes `static/parquet/m49.parquet` (via a temp CSV + DuckDB)
- Parquet and PMTiles files are synced to Cloudflare R2 via `npm run sync`

## UI conventions

- Each dropdown is wrapped in a `<div class="field">` with `display: flex; flex-direction: column; gap: 4px` so the label sits tight above its select
- Tooltips use CSS (`::hover` on a nested `.tooltip` span) rather than the `title` attribute for cross-browser reliability
- `[` / `]` keyboard shortcuts cycle through boundary sources (handled in `SourceSelect.svelte`)
