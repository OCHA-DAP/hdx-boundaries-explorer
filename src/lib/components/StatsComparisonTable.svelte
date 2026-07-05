<script lang="ts">
  import { selectSource, selectSourceLevel } from "$lib/map/admin";
  import { mapStore, selectedAdmin, selectedSource } from "$lib/map/store";
  import { getIso3166ForCountry, type Iso3166 } from "$lib/parquet/iso3166";
  import {
    getMapboxBoundariesForCountry,
    type MapboxBoundaries,
  } from "$lib/parquet/mapboxBoundaries";
  import { getProvenanceForCountry, type SourceProvenance } from "$lib/parquet/sourceProvenance";
  import { getStatsForCountry, type SourceStat } from "$lib/parquet/sourceStats";
  import { getDecisionForIso3, type Decision } from "$lib/sheet/decisions";
  import { ADMIN_SOURCES } from "$lib/sources";
  import { get } from "svelte/store";

  interface Props {
    iso3: string;
  }

  let { iso3 }: Props = $props();
  let stats: SourceStat[] = $state([]);
  let loading = $state(true);
  let decision: Decision | null = $state(null);
  let provenance: SourceProvenance[] = $state([]);
  let iso3166: Iso3166 | null = $state(null);
  let mapboxBoundaries: MapboxBoundaries | null = $state(null);

  function onSourceClick(sourceId: string) {
    selectSource(get(mapStore), iso3, sourceId);
  }

  function onCellClick(sourceId: string, level: number) {
    selectSourceLevel(get(mapStore), iso3, sourceId, level);
  }

  const LEVELS = [1, 2, 3, 4];

  // Internal and edge counts can differ by orders of magnitude for the same
  // country (an archipelago's edge count dwarfs its internal count), so each
  // value picks its own unit rather than sharing one across the table.
  function formatCount(n: number | bigint): string {
    const v = Number(n);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${Math.round(v)}`;
  }

  // The table sits in a panel with overflow-y: auto, which clips a CSS-only
  // above/below tooltip on whichever row happens to be closest to that edge
  // (the top row when opening upward, the bottom row when opening downward).
  // Positioning with `fixed` + coordinates computed on hover escapes that
  // clipping (fixed elements aren't confined by an ancestor's overflow unless
  // that ancestor has a transform, which none here do) and lets every row and
  // column pick whichever side actually has room in the viewport.
  const TOOLTIP_WIDTH = 220;
  const TOOLTIP_EST_HEIGHT = 90;
  const GAP = 4;

  let tooltipPos: { x: number; y: number; openBelow: boolean } | null = $state(null);

  function showTooltip(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const openBelow =
      rect.bottom + GAP + TOOLTIP_EST_HEIGHT <= window.innerHeight ||
      rect.top - GAP - TOOLTIP_EST_HEIGHT < 0;
    const x = Math.min(Math.max(rect.left, GAP), window.innerWidth - TOOLTIP_WIDTH - GAP);
    const y = openBelow ? rect.bottom + GAP : rect.top - GAP;
    tooltipPos = { x, y, openBelow };
  }

  function hideTooltip() {
    tooltipPos = null;
  }

  $effect(() => {
    const current = iso3;
    loading = true;
    let cancelled = false;
    getStatsForCountry(current).then((s) => {
      if (cancelled) return;
      stats = s;
      loading = false;
    });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const current = iso3;
    let cancelled = false;
    getDecisionForIso3(current).then((d) => {
      if (cancelled) return;
      decision = d;
    });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const current = iso3;
    let cancelled = false;
    getProvenanceForCountry(current).then((p) => {
      if (cancelled) return;
      provenance = p;
    });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const current = iso3;
    let cancelled = false;
    getIso3166ForCountry(current).then((i) => {
      if (cancelled) return;
      iso3166 = i;
    });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const current = iso3;
    let cancelled = false;
    getMapboxBoundariesForCountry(current).then((m) => {
      if (cancelled) return;
      mapboxBoundaries = m;
    });

    return () => {
      cancelled = true;
    };
  });

  interface SourceCol {
    id: string;
    label: string;
    levels: Record<number, SourceStat | undefined>;
    provenance: SourceProvenance | undefined;
  }

  let cols: SourceCol[] = $derived(
    ADMIN_SOURCES.map((source) => ({
      id: source.id,
      label: source.label,
      levels: Object.fromEntries(
        source.levels.map((level) => [
          level,
          stats.find((s) => s.source === source.id && s.level === level),
        ]),
      ),
      provenance: provenance.find((p) => p.source === source.id),
    })),
  );
</script>

{#if loading}
  <p class="muted">Loading stats…</p>
{:else}
  <table>
    <colgroup>
      <col class="level-col" />
      <col class="mapbox-col" />
      {#each cols as col (col.id)}
        <col />
      {/each}
    </colgroup>
    <thead>
      <tr>
        <th class="plain-cell">Level</th>
        <th class="mapbox-col"></th>
        {#each cols as col (col.id)}
          <th
            class:active-col={col.id === $selectedSource}
            class:team-pick={col.id === decision?.selectedSource}
            class:accepted={col.id === decision?.selectedSource && decision?.accepted}
          >
            <button class="source-btn" onclick={() => onSourceClick(col.id)}>
              {col.label}
              {#if col.id === decision?.selectedSource}
                <span
                  class="team-badge"
                  class:accepted={decision?.accepted}
                  title={decision?.accepted
                    ? "Team's accepted source"
                    : "Team's selected source (not yet accepted)"}>✓</span
                >
              {/if}
              {#if col.provenance?.sourceUpdated}
                <span class="source-updated">{col.provenance.sourceUpdated}</span>
              {/if}
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="plain-cell">Source</td>
        <td class="mapbox-col">
          {#if mapboxBoundaries?.iso2}
            <a
              class="mapbox-link"
              href="https://demos.mapbox.com/boundaries-explorer/?country={mapboxBoundaries.iso2}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mapbox
              <span class="iso-ref-tip"
                >Mapbox Boundaries admin unit counts — opens the Mapbox Boundaries Explorer for this
                country</span
              >
            </a>
          {:else}
            <span class="muted">Mapbox</span>
          {/if}
        </td>
        {#each cols as col (col.id)}
          <td class="provider-cell" class:active-col={col.id === $selectedSource}>
            {#if col.provenance?.provider}
              {col.provenance.provider}
            {:else}
              <span class="muted">—</span>
            {/if}
          </td>
        {/each}
      </tr>
      {#each LEVELS as level (level)}
        <tr class:active-row={level === $selectedAdmin}>
          <td class="plain-cell">
            Adm {level}
            {#if level === 1 && iso3166?.subdivisionCount != null}
              <a
                class="iso-ref"
                href="https://www.iso.org/obp/ui/#iso:code:3166:{iso3166.iso2}"
                target="_blank"
                rel="noopener noreferrer"
              >
                ISO: {iso3166.subdivisionCount}
                <span class="iso-ref-tip"
                  >ISO 3166-2 subdivision count for this country — opens iso.org/obp</span
                >
              </a>
            {/if}
          </td>
          <td class="mapbox-col">
            {#if mapboxBoundaries?.iso2 && mapboxBoundaries.counts[level] != null}
              <a
                class="mapbox-cell-link"
                href="https://demos.mapbox.com/boundaries-explorer/?country={mapboxBoundaries.iso2}&layer=adm{level}"
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatCount(mapboxBoundaries.counts[level])}
              </a>
            {:else}
              <span class="muted">—</span>
            {/if}
          </td>
          {#each cols as col (col.id)}
            <td
              class:active-col={col.id === $selectedSource}
              class:active-cell={col.id === $selectedSource && level === $selectedAdmin}
              class:team-pick={col.id === decision?.selectedSource}
            >
              {#if col.levels[level]}
                <button class="cell-btn" onclick={() => onCellClick(col.id, level)}>
                  {col.levels[level]?.featureCount.toLocaleString()} units
                  <span
                    class="muted vertex-hint"
                    role="note"
                    onmouseenter={showTooltip}
                    onmouseleave={hideTooltip}
                    >· {formatCount(col.levels[level]?.internalVertices ?? 0)} in / {formatCount(
                      col.levels[level]?.edgeVertices ?? 0,
                    )} out</span
                  >
                </button>
              {:else}
                <span class="muted">—</span>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if tooltipPos}
  <div
    class="tooltip"
    style:left="{tooltipPos.x}px"
    style:top="{tooltipPos.y}px"
    style:transform={tooltipPos.openBelow ? "none" : "translateY(-100%)"}
  >
    <strong>in</strong>: vertices on boundaries shared between units at this level (inner
    precision). <strong>out</strong>: vertices on the country's outer boundary — coastline /
    international border.
  </div>
{/if}

<style>
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }

  .level-col {
    width: 56px;
  }

  .mapbox-col {
    width: 52px;
    padding: 4px 6px;
    font-size: 10px;
  }

  .mapbox-link,
  .mapbox-cell-link {
    position: relative;
    display: block;
    color: #999;
    text-decoration: none;
    white-space: nowrap;
  }

  .mapbox-link:hover,
  .mapbox-cell-link:hover {
    text-decoration: underline;
  }

  .mapbox-link:hover .iso-ref-tip {
    display: block;
  }

  th,
  td {
    text-align: left;
    padding: 0;
    font-size: 11px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }

  th {
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 10px;
  }

  .plain-cell {
    padding: 4px 6px;
  }

  .provider-cell {
    padding: 4px 6px;
    color: #666;
    font-size: 10px;
    white-space: normal;
  }

  .muted {
    color: #999;
  }

  .vertex-hint {
    cursor: default;
  }

  .tooltip {
    position: fixed;
    z-index: 100;
    width: 220px;
    white-space: normal;
    background: #333;
    color: #fff;
    font-size: 11px;
    font-family: sans-serif;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
  }

  .source-btn,
  .cell-btn {
    display: block;
    width: 100%;
    height: 100%;
    text-align: left;
    padding: 4px 6px;
    margin: 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    border-radius: 3px;
  }

  .source-btn {
    font-weight: 600;
  }

  .source-updated {
    margin-left: 4px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    color: #999;
    font-size: 9px;
  }

  .iso-ref {
    position: relative;
    display: block;
    color: #999;
    font-size: 9px;
    text-decoration: none;
  }

  .iso-ref:hover {
    text-decoration: underline;
  }

  .iso-ref-tip {
    display: none;
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 10;
    width: 160px;
    white-space: normal;
    background: #333;
    color: #fff;
    font-size: 11px;
    font-family: sans-serif;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
  }

  .iso-ref:hover .iso-ref-tip {
    display: block;
  }

  .source-btn:hover,
  .cell-btn:hover {
    background: #f0f4ff;
  }

  tr.active-row,
  th.active-col,
  td.active-col {
    background: #f6f8fe;
  }

  td.active-cell {
    background: #dce6fd;
  }

  th.team-pick {
    box-shadow: inset 0 3px 0 #bbb;
  }

  th.team-pick.accepted {
    box-shadow: inset 0 3px 0 #1a7a3c;
  }

  td.team-pick {
    box-shadow: inset 3px 0 0 #eee;
  }

  .team-badge {
    margin-left: 3px;
    color: #999;
  }

  .team-badge.accepted {
    color: #1a7a3c;
  }

  td.active-cell .cell-btn:hover {
    background: #cddafc;
  }
</style>
