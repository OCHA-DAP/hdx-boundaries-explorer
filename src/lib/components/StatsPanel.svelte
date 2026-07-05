<script lang="ts">
  import { getDecisionForIso3, type Decision } from "$lib/sheet/decisions";
  import LabelsToggle from "./LabelsToggle.svelte";
  import StatsComparisonTable from "./StatsComparisonTable.svelte";

  interface Props {
    iso3: string;
  }

  let { iso3 }: Props = $props();
  let decision: Decision | null = $state(null);

  $effect(() => {
    const current = iso3;
    if (!current) {
      decision = null;
      return;
    }

    let cancelled = false;
    getDecisionForIso3(current).then((d) => {
      if (cancelled) return;
      decision = d;
    });

    return () => {
      cancelled = true;
    };
  });
</script>

<div class="stats-panel">
  <div class="stats-header">
    <div class="title-group">
      <h2>Compare sources</h2>
      {#if iso3 && decision?.rationale}
        <span class="rationale">— {decision.rationale}</span>
      {/if}
    </div>
    {#if iso3}
      <div class="header-controls">
        <p class="hint">
          [ ] to cycle sources
          <span class="tooltip">Use [ and ] to cycle through boundary sources</span>
        </p>
        <LabelsToggle />
      </div>
    {/if}
  </div>
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

  .stats-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 10px;
  }

  .title-group {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    flex-shrink: 0;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .hint {
    position: relative;
    margin: 0;
    font-size: 10px;
    color: #aaa;
    font-family: monospace;
    cursor: default;
  }

  .tooltip {
    display: none;
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: #333;
    color: #fff;
    font-size: 11px;
    font-family: sans-serif;
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
    z-index: 1;
  }

  .hint:hover .tooltip {
    display: block;
  }

  .muted {
    color: #999;
    font-size: 12px;
  }

  .rationale {
    font-size: 12px;
    color: #777;
    min-width: 0;
  }
</style>
