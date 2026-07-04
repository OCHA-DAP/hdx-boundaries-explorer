<script lang="ts">
  import { selectSource, selectSourceLevel } from "$lib/map/admin";
  import { mapStore, selectedAdmin, selectedSource } from "$lib/map/store";
  import { getStatsForCountry, type SourceStat } from "$lib/parquet/sourceStats";
  import { ADMIN_SOURCES } from "$lib/sources";
  import { get } from "svelte/store";

  interface Props {
    iso3: string;
  }

  let { iso3 }: Props = $props();
  let stats: SourceStat[] = $state([]);
  let loading = $state(true);

  function onSourceClick(sourceId: string) {
    selectSource(get(mapStore), iso3, sourceId);
  }

  function onCellClick(sourceId: string, level: number) {
    selectSourceLevel(get(mapStore), iso3, sourceId, level);
  }

  const LEVELS = [1, 2, 3, 4];

  const UNITS = [
    { divisor: 1_000_000, suffix: "M" },
    { divisor: 1_000, suffix: "k" },
    { divisor: 1, suffix: "" },
  ];

  // Pick the coarsest unit under which the smallest non-zero value in this
  // country's stats still rounds to at least 1, so no cell ever shows "0".
  let vertexUnit = $derived.by(() => {
    const nonZero = stats.map((s) => Number(s.totalVertices)).filter((v) => v > 0);
    const min = nonZero.length ? Math.min(...nonZero) : 0;
    return UNITS.find((u) => u.divisor <= min) ?? UNITS[UNITS.length - 1];
  });

  function formatVertices(n: number | bigint): string {
    return Math.round(Number(n) / vertexUnit.divisor).toLocaleString();
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

  interface SourceCol {
    id: string;
    label: string;
    levels: Record<number, SourceStat | undefined>;
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
    })),
  );
</script>

{#if loading}
  <p class="muted">Loading stats…</p>
{:else}
  <table>
    <thead>
      <tr>
        <th class="plain-cell">Level</th>
        {#each cols as col (col.id)}
          <th class:active-col={col.id === $selectedSource}>
            <button class="source-btn" onclick={() => onSourceClick(col.id)}>
              {col.label}
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each LEVELS as level (level)}
        <tr class:active-row={level === $selectedAdmin}>
          <td class="plain-cell">Adm {level}</td>
          {#each cols as col (col.id)}
            <td
              class:active-col={col.id === $selectedSource}
              class:active-cell={col.id === $selectedSource && level === $selectedAdmin}
            >
              {#if col.levels[level]}
                <button class="cell-btn" onclick={() => onCellClick(col.id, level)}>
                  {col.levels[level]?.featureCount.toLocaleString()} units
                  <span class="muted"
                    >· {formatVertices(col.levels[level]?.totalVertices ?? 0)}{vertexUnit.suffix} pts</span
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

<style>
  table {
    width: 100%;
    border-collapse: collapse;
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

  .muted {
    color: #999;
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

  td.active-cell .cell-btn:hover {
    background: #cddafc;
  }
</style>
