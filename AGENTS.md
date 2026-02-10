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
```

There are no tests configured yet.

## Architecture

**SvelteKit + TypeScript** app using **Svelte 5** (runes syntax: `$props()`, `$state()`, etc.) and **MapLibre GL** for interactive mapping.

- `src/routes/` — file-based routing; `+page.svelte` is a page, `+layout.svelte` wraps all pages
- `src/lib/` — shared components and utilities, importable via `$lib/` alias
- `static/` — assets served as-is (no processing)

The project is an early-stage explorer for HDX (Humanitarian Data Exchange) geographic boundaries. MapLibre GL (`maplibre-gl`) is the primary mapping library.

Uses `adapter-auto` which detects the deployment target; may need replacing with a specific adapter (e.g., `adapter-static`) for deployment.
