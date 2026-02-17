<script lang="ts">
  import { applyAdminFilter } from '$lib/map/admin';
  import { mapStore, selectedAdmin, selectedIso3, selectedSource } from '$lib/map/store';
  import { ADMIN_SOURCES, getLevelsForSource } from '$lib/sources';
  import { get } from 'svelte/store';

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

<div class="field">
  <div class="label-row">
    <label for="source-select">Source</label>
    <span class="hint">
      [ ] to cycle
      <span class="tooltip">Use [ and ] to cycle through sources</span>
    </span>
  </div>
  <select id="source-select" value={$selectedSource} onchange={onSelect}>
    {#each ADMIN_SOURCES as source (source.id)}
      <option value={source.id}>{source.label}</option>
    {/each}
  </select>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
  }

  .hint {
    position: relative;
    font-size: 10px;
    color: #aaa;
    font-family: monospace;
    cursor: default;
  }

  .tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 4px);
    right: 0;
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
