<script lang="ts">
  import { getStatsForCountry, type SourceStat } from "$lib/parquet/sourceStats";
  import { ADMIN_SOURCES } from "$lib/sources";

  interface Props {
    iso3: string;
  }

  let { iso3 }: Props = $props();
  let stats: SourceStat[] = $state([]);
  let loading = $state(true);

  const LEVELS = [1, 2, 3, 4];

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

  interface SourceRow {
    id: string;
    label: string;
    levels: Record<number, SourceStat | undefined>;
  }

  let rows: SourceRow[] = $derived(
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
        <th>Source</th>
        {#each LEVELS as level (level)}
          <th>Adm {level}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.id)}
        <tr>
          <td>{row.label}</td>
          {#each LEVELS as level (level)}
            <td>
              {#if row.levels[level]}
                {row.levels[level]?.featureCount.toLocaleString()} units<br />
                <span class="muted">{row.levels[level]?.totalVertices.toLocaleString()} pts</span>
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
    padding: 4px 6px;
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

  .muted {
    color: #999;
  }
</style>
