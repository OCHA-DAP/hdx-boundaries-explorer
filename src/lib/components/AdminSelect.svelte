<script lang="ts">
  import { applyAdminFilter } from '$lib/map/admin';
  import { ADMIN_LEVELS } from '$lib/map/layers/admin';
  import { getAdminCount } from '$lib/parquet/adminCount';
  import {
    mapStore as globalMapStore,
    selectedAdmin as globalAdmin,
    selectedIso3,
    selectedSource as globalSource,
  } from '$lib/map/store';
  import { getLevelsForSource } from '$lib/sources';
  import type { Writable } from 'svelte/store';
  import { get } from 'svelte/store';
  import type maplibregl from 'maplibre-gl';

  interface Props {
    sourceStore?: Writable<string>;
    adminStore?: Writable<number>;
    mapStoreOverride?: Writable<maplibregl.Map | null>;
  }

  let {
    sourceStore = globalSource,
    adminStore = globalAdmin,
    mapStoreOverride = globalMapStore,
  }: Props = $props();

  const isGlobal = $derived(sourceStore === globalSource);

  let counts: Record<number, number | null> = $state(
    Object.fromEntries(ADMIN_LEVELS.map((l) => [l, null])),
  );

  $effect(() => {
    const iso3 = $selectedIso3;
    const source = $sourceStore;
    const sourceLevels = getLevelsForSource(source);

    // Levels not in this source are immediately 0; source levels start as null (loading)
    counts = Object.fromEntries(ADMIN_LEVELS.map((l) => [l, sourceLevels.includes(l) ? null : 0]));
    if (!iso3) return;

    let cancelled = false;

    // Update counts incrementally for display
    for (const level of sourceLevels) {
      getAdminCount(source, level, iso3).then((n) => {
        if (!cancelled) counts = { ...counts, [level]: n };
      });
    }

    // Once all counts are known, stay on current level if it has data,
    // otherwise drop to the deepest non-empty level
    Promise.all(
      sourceLevels.map((level) => getAdminCount(source, level, iso3).then((n) => ({ level, n }))),
    ).then((results) => {
      if (cancelled) return;
      const current = get(adminStore);
      const currentCount = results.find((r) => r.level === current)?.n ?? 0;
      if (currentCount === 0) {
        const best = [...results].reverse().find((r) => r.n > 0);
        if (!best) return;
        adminStore.set(best.level);
      }
      const map = get(mapStoreOverride);
      if (!map) return;
      applyAdminFilter(map, iso3, get(sourceStore), get(adminStore));
    });

    return () => {
      cancelled = true;
    };
  });

  function onSelect(e: Event) {
    const level = Number((e.target as HTMLSelectElement).value);
    adminStore.set(level);

    const map = get(mapStoreOverride);
    const iso3 = get(selectedIso3);
    if (!map || !iso3) return;

    applyAdminFilter(map, iso3, get(sourceStore), level);
  }
</script>

<div class="field">
  <label for="admin-select-{isGlobal ? 'global' : 'right'}">Admin Level</label>
  <select
    id="admin-select-{isGlobal ? 'global' : 'right'}"
    value={$adminStore}
    onchange={onSelect}
  >
    {#each ADMIN_LEVELS.filter((l) => counts[l] !== 0) as level (level)}
      <option value={level}>
        Admin {level}{counts[level] !== null ? ` (${counts[level]})` : ''}
      </option>
    {/each}
  </select>
</div>

<style>
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
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    color: #1a1a1a;
    background: white;
    cursor: pointer;
    appearance: auto;
  }

  select:focus {
    outline: none;
    border-color: #aaa;
  }
</style>
