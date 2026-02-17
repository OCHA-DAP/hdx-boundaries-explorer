<script lang="ts">
  import { get } from 'svelte/store';
  import { applyAdminFilter } from '$lib/map/admin';
  import { mapStore, selectedAdmin, selectedIso3, selectedSource } from '$lib/map/store';
  import { ADMIN_SOURCES, getLevelsForSource } from '$lib/sources';

  function onSelect(e: Event) {
    const source = (e.target as HTMLSelectElement).value;
    selectedSource.set(source);

    // Clamp selectedAdmin to the deepest level available in the new source
    const levels = getLevelsForSource(source);
    const current = get(selectedAdmin);
    if (!levels.includes(current as (typeof levels)[number])) {
      selectedAdmin.set(levels[levels.length - 1]);
    }

    const map = get(mapStore);
    const iso3 = get(selectedIso3);
    if (!map || !iso3) return;
    applyAdminFilter(map, iso3);
  }
</script>

<label for="source-select">Source</label>
<select id="source-select" value={$selectedSource} onchange={onSelect}>
  {#each ADMIN_SOURCES as source (source.id)}
    <option value={source.id}>{source.label}</option>
  {/each}
</select>

<style>
  label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
    margin-bottom: 4px;
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
