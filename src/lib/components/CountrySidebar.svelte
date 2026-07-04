<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { selectCountry, selectSource } from "$lib/map/admin";
  import { mapStore, selectedIso3, selectedSource } from "$lib/map/store";
  import { getCountries, type Country } from "$lib/parquet/countries";
  import { getAllPlanStatus, type PlanStatus } from "$lib/parquet/planStatus";
  import { DECISION_STATUS_LABELS, getDecisions, type Decision } from "$lib/sheet/decisions";
  import { ADMIN_SOURCES } from "$lib/sources";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import DecisionPanel from "./DecisionPanel.svelte";
  import LabelsToggle from "./LabelsToggle.svelte";
  import RelevanceBadge from "./RelevanceBadge.svelte";

  interface Row {
    iso3: string;
    name: string;
    plan: PlanStatus | null;
    decision: Decision | null;
  }

  let rows: Row[] = $state([]);
  let loading = $state(true);
  let filter = $state("");
  let sortKey: "relevance" | "name" | "status" = $state("relevance");

  onMount(async () => {
    const [countries, plans, decisions]: [
      Country[],
      Map<string, PlanStatus>,
      Map<string, Decision>,
    ] = await Promise.all([getCountries(), getAllPlanStatus(), getDecisions()]);
    rows = countries.map((c) => ({
      iso3: c.iso3,
      name: c.name,
      plan: plans.get(c.iso3) ?? null,
      decision: decisions.get(c.iso3) ?? null,
    }));
    loading = false;
  });

  function sourceLabel(id: string | null): string {
    if (!id) return "";
    return ADMIN_SOURCES.find((s) => s.id === id)?.label ?? id;
  }

  let filtered: Row[] = $derived(
    rows.filter((r) => {
      const q = filter.trim().toLowerCase();
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.iso3.toLowerCase().includes(q);
    }),
  );

  let sorted: Row[] = $derived(
    [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "status") {
        const statusA = a.decision?.status ?? "no_opinion";
        const statusB = b.decision?.status ?? "no_opinion";
        return statusA.localeCompare(statusB);
      }
      const rankA = a.plan?.rank ?? 5;
      const rankB = b.plan?.rank ?? 5;
      if (rankA !== rankB) return rankA - rankB;
      const yearA = Number(a.plan?.planYear ?? -Infinity);
      const yearB = Number(b.plan?.planYear ?? -Infinity);
      if (yearA !== yearB) return yearB - yearA;
      return a.name.localeCompare(b.name);
    }),
  );

  function selectRow(iso3: string) {
    selectCountry(get(mapStore), iso3);
    goto(resolve(`/?country=${iso3}`), { replaceState: true, noScroll: true, keepFocus: true });
  }

  let selectedName = $derived(rows.find((r) => r.iso3 === $selectedIso3)?.name ?? null);

  function onKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement && e.target.type !== "checkbox") return;
    if (e.key !== "[" && e.key !== "]") return;

    const idx = ADMIN_SOURCES.findIndex((s) => s.id === get(selectedSource));
    const next =
      e.key === "]"
        ? (idx + 1) % ADMIN_SOURCES.length
        : (idx - 1 + ADMIN_SOURCES.length) % ADMIN_SOURCES.length;
    selectSource(get(mapStore), get(selectedIso3), ADMIN_SOURCES[next].id);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<aside class="sidebar">
  <div class="sidebar-header">
    <h1>HDX Boundaries <span class="beta">beta</span></h1>
    <p class="subtitle">For internal use only</p>
    <p class="lede">Ranked by humanitarian plan status to help prioritize decisions.</p>
  </div>

  <div class="controls">
    {#if $selectedIso3}
      <p class="current-country">
        {selectedName ? `${selectedName} (${$selectedIso3})` : $selectedIso3}
      </p>
      <p class="hint">
        [ ] to cycle sources
        <span class="tooltip">Use [ and ] to cycle through boundary sources</span>
      </p>
      <LabelsToggle />
      <DecisionPanel iso3={$selectedIso3} />
    {:else}
      <p class="muted">Select a country below to see source options and decisions.</p>
    {/if}
  </div>

  <div class="toolbar">
    <input type="text" placeholder="Filter by name or ISO3…" bind:value={filter} />
    <div class="field">
      <label for="sort-select">Sort by</label>
      <select id="sort-select" bind:value={sortKey}>
        <option value="relevance">Humanitarian relevance</option>
        <option value="name">Country name</option>
        <option value="status">Decision status</option>
      </select>
    </div>
  </div>

  {#if loading}
    <p class="empty">Loading countries…</p>
  {:else}
    <ul class="country-list">
      {#each sorted as row (row.iso3)}
        <li>
          <button
            type="button"
            class="country-row"
            class:selected={row.iso3 === $selectedIso3}
            onclick={() => selectRow(row.iso3)}
          >
            <span class="name">{row.name}</span>
            <span class="iso3">{row.iso3}</span>
            <RelevanceBadge
              rank={row.plan?.rank ?? 5}
              planType={row.plan?.planType ?? null}
              planYear={row.plan?.planYear ?? null}
            />
            {#if row.decision && row.decision.status !== "no_opinion"}
              <span class="decision-tag">
                {DECISION_STATUS_LABELS[row.decision.status]}
                {#if row.decision.selectedSource}
                  · {sourceLabel(row.decision.selectedSource)}
                {/if}
              </span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .sidebar {
    width: 320px;
    flex-shrink: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: white;
    border-right: 1px solid #eee;
    font-family: sans-serif;
    color: #1a1a1a;
  }

  .sidebar-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border-bottom: 1px solid #eee;
  }

  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  h1 .beta {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #fff;
    background: #e8621a;
    border-radius: 3px;
    padding: 2px 5px 0;
    vertical-align: middle;
    position: relative;
    top: -2px;
  }

  .subtitle {
    font-size: 11px;
    color: #888;
    margin: 0;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .lede {
    font-size: 12px;
    color: #555;
    margin: 0;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid #eee;
  }

  .current-country {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .muted {
    margin: 0;
    font-size: 12px;
    color: #999;
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
    left: 0;
    background: #333;
    color: #fff;
    font-size: 11px;
    font-family: sans-serif;
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
  }

  .hint:hover .tooltip {
    display: block;
  }

  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border-bottom: 1px solid #eee;
  }

  .toolbar input[type="text"] {
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
  }

  select {
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
  }

  .empty {
    color: #999;
    font-size: 13px;
    padding: 16px;
  }

  .country-list {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    overflow-y: auto;
  }

  .country-row {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-bottom: 1px solid #f2f2f2;
    padding: 6px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: inherit;
  }

  .country-row:hover {
    background: #f7f9fb;
  }

  .country-row.selected {
    background: #eaf2fb;
  }

  .name {
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .iso3 {
    font-size: 10px;
    color: #999;
    flex-shrink: 0;
  }

  .decision-tag {
    font-size: 10px;
    color: #555;
    flex-shrink: 0;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
