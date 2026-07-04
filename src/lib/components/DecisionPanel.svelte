<script lang="ts">
  import { DECISION_STATUS_LABELS, getDecisionForIso3, type Decision } from "$lib/sheet/decisions";
  import { ADMIN_SOURCES } from "$lib/sources";

  interface Props {
    iso3: string;
  }

  let { iso3 }: Props = $props();
  let decision: Decision | null = $state(null);
  let loading = $state(false);

  $effect(() => {
    const current = iso3;
    if (!current) {
      decision = null;
      return;
    }

    loading = true;
    let cancelled = false;
    getDecisionForIso3(current).then((d) => {
      if (cancelled) return;
      decision = d;
      loading = false;
    });

    return () => {
      cancelled = true;
    };
  });

  function sourceLabel(id: string | null): string {
    if (!id) return "—";
    return ADMIN_SOURCES.find((s) => s.id === id)?.label ?? id;
  }
</script>

{#if iso3}
  <div class="field">
    <span class="field-label">Team decision</span>
    {#if loading}
      <p class="muted">Loading…</p>
    {:else if decision}
      <p class="status">{DECISION_STATUS_LABELS[decision.status]}</p>
      <p class="source">Selected source: <strong>{sourceLabel(decision.selectedSource)}</strong></p>
      {#if decision.rationale}
        <p class="rationale">{decision.rationale}</p>
      {/if}
      {#if decision.lastUpdated}
        <p class="updated">Updated {decision.lastUpdated}</p>
      {/if}
    {:else}
      <p class="muted">No decision recorded yet.</p>
    {/if}
  </div>
{/if}

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
  }

  p {
    margin: 0;
    font-size: 12px;
    color: #1a1a1a;
  }

  .muted {
    color: #999;
  }

  .rationale {
    color: #444;
    white-space: pre-wrap;
  }

  .updated {
    color: #999;
    font-size: 11px;
  }
</style>
