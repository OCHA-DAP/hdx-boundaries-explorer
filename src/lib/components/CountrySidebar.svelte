<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { selectCountry, selectSource } from "$lib/map/admin";
  import { mapStore, selectedIso3, selectedSource } from "$lib/map/store";
  import { getCountries } from "$lib/parquet/countries";
  import { getAllOfficeTypes, type OfficeType } from "$lib/parquet/officeType";
  import { getAllPlanStatus, type PlanStatus } from "$lib/parquet/planStatus";
  import { acceptedLabel, getDecisions, type Decision } from "$lib/sheet/decisions";
  import { ADMIN_SOURCES } from "$lib/sources";
  import { onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import OfficeTypeBadge from "./OfficeTypeBadge.svelte";
  import RelevanceBadge from "./RelevanceBadge.svelte";

  interface Row {
    iso3: string;
    name: string;
    plan: PlanStatus | null;
    decision: Decision | null;
    officeType: OfficeType | null;
  }

  let rows: Row[] = $state([]);
  let loading = $state(true);
  let filter = $state("");
  let sortKey: "officeType" | "relevance" | "name" | "accepted" = $state("officeType");
  let listEl: HTMLUListElement | undefined = $state();
  let skipNextCenter = false;

  onMount(async () => {
    const [countries, plans, decisions, officeTypes] = await Promise.all([
      getCountries(),
      getAllPlanStatus(),
      getDecisions(),
      getAllOfficeTypes(),
    ]);
    rows = countries.map((c) => ({
      iso3: c.iso3,
      name: c.name,
      plan: plans.get(c.iso3) ?? null,
      decision: decisions.get(c.iso3) ?? null,
      officeType: officeTypes.get(c.iso3) ?? null,
    }));
    loading = false;
  });

  // Scrolls the selected country's row to the middle of the list whenever the
  // selection changes — covers the initial ?country= query-param load and
  // clicking a country directly on the map. Skipped when the selection change
  // came from clicking a row in this list itself (skipNextCenter), since the
  // row is already in view and re-centering it under the user's cursor is
  // disorienting.
  $effect(() => {
    const iso3 = $selectedIso3;
    if (!iso3 || loading) return;

    if (skipNextCenter) {
      skipNextCenter = false;
      return;
    }

    tick().then(() => {
      listEl
        ?.querySelector<HTMLElement>(`[data-iso3="${iso3}"]`)
        ?.scrollIntoView({ block: "center" });
    });
  });

  // Abbreviated for the sidebar's narrow decision-source column — every
  // other source's label is already short (OCHA, WFP, UNICEF, UNHCR, FAO,
  // SALB); only World Bank's full label needs shortening here. The full
  // "World Bank" label is still used elsewhere (e.g. StatsComparisonTable).
  const SOURCE_LABEL_OVERRIDES: Record<string, string> = { wb: "WB" };

  function sourceLabel(id: string | null): string {
    if (!id) return "";
    return SOURCE_LABEL_OVERRIDES[id] ?? ADMIN_SOURCES.find((s) => s.id === id)?.label ?? id;
  }

  const OFFICE_TYPE_RANK: Record<OfficeType, number> = { CO: 0, RO: 1, HAT: 2 };

  function relevanceCompare(a: Row, b: Row): number {
    const rankA = a.plan?.rank ?? 5;
    const rankB = b.plan?.rank ?? 5;
    if (rankA !== rankB) return rankA - rankB;
    const yearA = Number(a.plan?.planYear ?? -Infinity);
    const yearB = Number(b.plan?.planYear ?? -Infinity);
    if (yearA !== yearB) return yearB - yearA;
    return a.name.localeCompare(b.name);
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
      if (sortKey === "officeType") {
        const rankA = a.officeType ? OFFICE_TYPE_RANK[a.officeType] : 3;
        const rankB = b.officeType ? OFFICE_TYPE_RANK[b.officeType] : 3;
        if (rankA !== rankB) return rankA - rankB;
        return relevanceCompare(a, b);
      }
      return relevanceCompare(a, b);
    }),
  );

  function selectRow(iso3: string) {
    skipNextCenter = true;
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
        <option value="officeType">OCHA office type</option>
        <option value="relevance">Humanitarian relevance</option>
        <option value="name">Country name</option>
        <option value="accepted">Decision status</option>
      </select>
    </div>
  </div>

  {#if loading}
    <p class="empty">Loading countries…</p>
  {:else}
    <div class="country-row-header">
      <span class="header-label">Country or Area</span>
      <span class="header-label">ISO3</span>
      <span class="header-label tooltip"
        >Type<span class="tooltip-text">OCHA office type</span></span
      >
      <span class="header-label tooltip"
        >Plan<span class="tooltip-text">Humanitarian plan relevance</span></span
      >
      <span class="header-label tooltip"
        >Source<span class="tooltip-text">Team's selected source</span></span
      >
      <span class="header-label tooltip"
        >Status<span class="tooltip-text">Decision status</span></span
      >
    </div>
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
            <OfficeTypeBadge officeType={row.officeType} />
            <RelevanceBadge
              rank={row.plan?.rank ?? 5}
              planType={row.plan?.planType ?? null}
              planYear={row.plan?.planYear ?? null}
            />
            {#if row.decision?.noSourceSuitable}
              <span class="decision-status none">None suitable</span>
            {:else if row.decision && (row.decision.accepted || row.decision.selectedSource)}
              <span class="decision-source">{sourceLabel(row.decision.selectedSource)}</span>
              <span class="decision-status">{acceptedLabel(row.decision.accepted)}</span>
            {:else}
              <span class="decision-source" aria-hidden="true"></span>
              <span class="decision-status" aria-hidden="true"></span>
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

  .country-row-header {
    display: grid;
    grid-template-columns: 1fr 32px 28px 28px 44px 50px;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border-bottom: 1px solid #eee;
  }

  .header-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: relative;
  }

  .header-label.tooltip .tooltip-text {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    white-space: nowrap;
    transition: opacity 0.15s;
    z-index: 10;
  }

  .header-label.tooltip:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
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
    grid-template-columns: 1fr 32px 28px 28px 44px 50px;
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

  .decision-source,
  .decision-status {
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .decision-source {
    color: #555;
    font-weight: 600;
  }

  .decision-status {
    color: #aaa;
    font-weight: 400;
  }

  .decision-status.none {
    grid-column: span 2;
    color: #a33;
    font-style: italic;
  }
</style>
