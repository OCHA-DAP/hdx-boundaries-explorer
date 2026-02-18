<script lang="ts">
  import AdminSelect from '$lib/components/AdminSelect.svelte';
  import CountrySelect from '$lib/components/CountrySelect.svelte';
  import LabelsToggle from '$lib/components/LabelsToggle.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import SourceSelect from '$lib/components/SourceSelect.svelte';
  import SplitToggle from '$lib/components/SplitToggle.svelte';
  import { initMap } from '$lib/map';
  import { applyAdminFilter } from '$lib/map/admin';
  import { mapStore, selectedIso3, splitMode } from '$lib/map/store';
  import { syncMaps } from '$lib/map/sync';
  import type maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import { get, writable } from 'svelte/store';

  let mapContainer: HTMLDivElement;
  let rightContainer = $state<HTMLDivElement | undefined>(undefined);

  // Per-panel state for the right pane
  const source2 = writable('ocha');
  const admin2 = writable(1);
  const mapStore2 = writable<maplibregl.Map | null>(null);

  onMount(() => initMap(mapContainer));

  $effect(() => {
    if (!$splitMode || !rightContainer) return;

    const cleanup = initMap(rightContainer, {
      sourceStore: source2,
      adminStore: admin2,
      mapStoreOverride: mapStore2,
    });

    const map1 = get(mapStore);
    const map2 = get(mapStore2);

    let unsync = () => {};
    if (map1 && map2) {
      unsync = syncMaps(map1, map2);
      map2.jumpTo({
        center: map1.getCenter(),
        zoom: map1.getZoom(),
        bearing: map1.getBearing(),
        pitch: map1.getPitch(),
      });
    }

    // Sync country selection to the right map via an explicit subscription so
    // it works reliably regardless of Svelte 5's reactive-tracking timing.
    const syncCountry = (iso3: string) => {
      const m2 = get(mapStore2);
      if (!m2) return;
      const apply = () => applyAdminFilter(m2, iso3, get(source2), get(admin2));
      if (m2.isStyleLoaded()) {
        apply();
      } else {
        m2.once('style.load', apply);
      }
    };
    const unsubscribeCountry = selectedIso3.subscribe(syncCountry);

    return () => {
      unsubscribeCountry();
      unsync();
      cleanup();
    };
  });
</script>

<div class="map-root" class:split={$splitMode}>
  <div class="pane">
    <div bind:this={mapContainer} class="map"></div>
    <Panel>
      <h1>HDX Boundaries Explorer</h1>
      <p class="subtitle">For internal use only</p>
      <CountrySelect />
      <SourceSelect />
      <AdminSelect />
      <LabelsToggle />
    </Panel>
  </div>
  {#if $splitMode}
    <div class="pane">
      <div bind:this={rightContainer} class="map"></div>
      <Panel>
        <SourceSelect sourceStore={source2} adminStore={admin2} mapStoreOverride={mapStore2} />
        <AdminSelect sourceStore={source2} adminStore={admin2} mapStoreOverride={mapStore2} />
        <LabelsToggle />
      </Panel>
    </div>
  {/if}
</div>
<SplitToggle />

<style>
  :global(.feature-tooltip .maplibregl-popup-content) {
    padding: 6px 10px;
    font-family: sans-serif;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    border-radius: 4px;
    pointer-events: none;
  }

  :global(.feature-tooltip .maplibregl-popup-tip) {
    display: none;
  }

  :global(.feature-tooltip .feature-tooltip-code) {
    font-size: 11px;
    opacity: 0.7;
  }

  .map-root {
    position: fixed;
    inset: 0;
    display: flex;
  }

  .pane {
    position: relative;
    flex: 1;
    height: 100%;
  }

  .map {
    width: 100%;
    height: 100%;
  }

  .subtitle {
    font-size: 11px;
    color: #888;
    margin: -8px 0 0 0;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
</style>
