<script lang="ts">
  import StatsComparisonTable from "./StatsComparisonTable.svelte";

  interface Props {
    iso3: string;
  }

  let { iso3 }: Props = $props();
</script>

<div class="stats-panel">
  <h2>Compare sources</h2>
  {#if iso3}
    <StatsComparisonTable {iso3} />
  {:else}
    <p class="muted">Select a country to compare sources.</p>
  {/if}
</div>

<style>
  .stats-panel {
    flex-shrink: 0;
    max-height: 40vh;
    overflow-y: auto;
    background: white;
    border-top: 1px solid #ddd;
    box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.08);
    padding: 16px;
    font-family: sans-serif;
    font-size: 13px;
  }

  h2 {
    margin: 0 0 10px 0;
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .muted {
    color: #999;
    font-size: 12px;
  }
</style>
