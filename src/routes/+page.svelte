<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import { initMap } from '$lib/map';
  import Panel from '$lib/components/Panel.svelte';
  import CountrySelect from '$lib/components/CountrySelect.svelte';
  import AdminSelect from '$lib/components/AdminSelect.svelte';
  import SourceSelect from '$lib/components/SourceSelect.svelte';
  import LabelsToggle from '$lib/components/LabelsToggle.svelte';

  let mapContainer: HTMLDivElement;

  onMount(() => initMap(mapContainer));
</script>

<div class="map-root">
  <div bind:this={mapContainer} class="map"></div>
  <Panel>
    <h1>HDX Boundaries Explorer</h1>
    <CountrySelect />
    <SourceSelect />
    <AdminSelect />
    <LabelsToggle />
  </Panel>
</div>

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
    position: relative;
    width: 100vw;
    height: 100vh;
  }

  .map {
    width: 100%;
    height: 100%;
  }
</style>
