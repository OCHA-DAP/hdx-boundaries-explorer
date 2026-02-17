<script lang="ts">
  import { applyAdminFilter } from '$lib/map/admin';
  import { mapStore, selectedIso3 } from '$lib/map/store';
  import { getBboxForIso3 } from '$lib/parquet/bbox';
  import { getCountries, type Country } from '$lib/parquet/countries';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let countries: Country[] = $state([]);

  onMount(async () => {
    countries = await getCountries();
  });

  async function onSelect(e: Event) {
    const iso3 = (e.target as HTMLSelectElement).value;
    selectedIso3.set(iso3);
    if (!iso3) return;

    const bbox = await getBboxForIso3(iso3);
    if (!bbox) return;

    const map = get(mapStore);
    if (!map) return;

    applyAdminFilter(map, iso3);

    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]]
      ],
      { padding: 50 }
    );
  }
</script>

<label for="country-select">Country / Territory</label>
<select id="country-select" value={$selectedIso3} onchange={onSelect}>
  <option value="">Select…</option>
  {#each countries as country (country.iso3)}
    <option value={country.iso3}>{country.name} ({country.iso3})</option>
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
