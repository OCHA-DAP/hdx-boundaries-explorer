<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { selectCountry, selectSource } from "$lib/map/admin";
  import { mapStore, selectedIso3, selectedSource } from "$lib/map/store";
  import { getCountries, type Country } from "$lib/parquet/countries";
  import { getAllPlanStatus, type PlanStatus } from "$lib/parquet/planStatus";
  import { acceptedLabel, getDecisions, type Decision } from "$lib/sheet/decisions";
  import { ADMIN_SOURCES } from "$lib/sources";
  import { onMount, tick } from "svelte";
  import { get } from "svelte/store";
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
  let sortKey: "relevance" | "name" | "accepted" = $state("relevance");
  let listEl: HTMLUListElement | undefined = $state();

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

    const initialIso3 = page.url.searchParams.get("country")?.toUpperCase();
    if (initialIso3) {
      await tick();
      listEl
        ?.querySelector<HTMLElement>(`[data-iso3="${initialIso3}"]`)
        ?.scrollIntoView({ block: "center" });
    }
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
      if (sortKey === "accepted") {
        const acceptedA = a.decision?.accepted ?? false;
        const acceptedB = b.decision?.accepted ?? false;
        return Number(acceptedA) - Number(acceptedB);
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
    <div class="wordmark">HDX</div>
    <h1>Boundaries Explorer</h1>
  </div>

  <div class="toolbar">
    <input type="text" placeholder="Filter by name or ISO3…" bind:value={filter} />
    <div class="field">
      <label for="sort-select">Sort by</label>
      <select id="sort-select" bind:value={sortKey}>
        <option value="relevance">Humanitarian relevance</option>
        <option value="name">Country name</option>
        <option value="accepted">Decision status</option>
      </select>
    </div>
  </div>

  {#if loading}
    <p class="empty">Loading countries…</p>
  {:else}
    <ul class="country-list" bind:this={listEl}>
      {#each sorted as row (row.iso3)}
        <li>
          <button
            type="button"
            class="country-row"
            class:selected={row.iso3 === $selectedIso3}
            data-iso3={row.iso3}
            onclick={() => selectRow(row.iso3)}
          >
            <span class="name">{row.name}</span>
            <span class="iso3">{row.iso3}</span>
            <RelevanceBadge
              rank={row.plan?.rank ?? 5}
              planType={row.plan?.planType ?? null}
              planYear={row.plan?.planYear ?? null}
            />
            {#if row.decision?.noSourceSuitable}
              <span class="decision-tag none">None suitable</span>
            {:else if row.decision && (row.decision.accepted || row.decision.selectedSource)}
              <span class="decision-tag" class:accepted={row.decision.accepted}>
                {acceptedLabel(row.decision.accepted)}
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
    width: 400px;
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
    gap: 2px;
    padding: 16px;
    border-bottom: 1px solid #eee;
  }

  .wordmark {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: #2060a0;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #1a3a5c;
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
    display: grid;
    grid-template-columns: 1fr 32px 84px 116px;
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
    min-width: 0;
  }

  .iso3 {
    font-size: 10px;
    color: #999;
  }

  .decision-tag {
    font-size: 10px;
    color: #555;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .decision-tag.accepted {
    color: #1a7a3c;
    font-weight: 600;
  }

  .decision-tag.none {
    color: #a33;
    font-style: italic;
  }
</style>
