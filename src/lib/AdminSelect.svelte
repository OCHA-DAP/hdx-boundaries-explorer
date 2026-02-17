<script lang="ts">
  import { applyAdminFilter } from '$lib/map/admin';
  import { ADMIN_LEVELS } from '$lib/map/layers/admin';
  import { mapStore, selectedAdmin, selectedIso3 } from '$lib/map/store';
  import { get } from 'svelte/store';

  function onSelect(e: Event) {
    const level = Number((e.target as HTMLSelectElement).value);
    selectedAdmin.set(level);

    const map = get(mapStore);
    const iso3 = get(selectedIso3);
    if (!map || !iso3) return;

    applyAdminFilter(map, iso3);
  }
</script>

<label for="admin-select">Admin Level</label>
<select id="admin-select" value={$selectedAdmin} onchange={onSelect}>
  {#each ADMIN_LEVELS as level (level)}
    <option value={level}>Admin {level}</option>
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
