<script lang="ts">
  import { get } from 'svelte/store';
  import { applyAdminFilter } from '$lib/map/admin';
  import { mapStore, selectedAdmin, selectedIso3, selectedSource } from '$lib/map/store';
  import { ADMIN_SOURCES, getLevelsForSource } from '$lib/sources';

  function switchTo(sourceId: string) {
    selectedSource.set(sourceId);

    const levels = getLevelsForSource(sourceId);
    const current = get(selectedAdmin);
    if (!levels.includes(current as (typeof levels)[number])) {
      selectedAdmin.set(levels[levels.length - 1]);
    }

    const map = get(mapStore);
    const iso3 = get(selectedIso3);
    if (!map || !iso3) return;
    applyAdminFilter(map, iso3);
  }

  function onSelect(e: Event) {
    switchTo((e.target as HTMLSelectElement).value);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key !== '[' && e.key !== ']') return;

    const idx = ADMIN_SOURCES.findIndex((s) => s.id === get(selectedSource));
    const next =
      e.key === ']'
        ? (idx + 1) % ADMIN_SOURCES.length
        : (idx - 1 + ADMIN_SOURCES.length) % ADMIN_SOURCES.length;
    switchTo(ADMIN_SOURCES[next].id);
  }
</script>

<svelte:window onkeydown={onKeydown} />

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
