<script lang="ts">
  import AdminSelect from '$lib/components/AdminSelect.svelte';
  import CountrySelect from '$lib/components/CountrySelect.svelte';
  import LabelsToggle from '$lib/components/LabelsToggle.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import SourceSelect from '$lib/components/SourceSelect.svelte';
  import { initMap } from '$lib/map';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';

  let mapContainer: HTMLDivElement;

  onMount(() => initMap(mapContainer));
</script>

<div class="map-root">
  <div bind:this={mapContainer} class="map"></div>
  <Panel>
    <h1>HDX Boundaries Explorer <span class="beta">beta</span></h1>
    <p class="subtitle">For internal use only</p>
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

  h1 .beta {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #fff;
    background: #e8621a;
    border-radius: 3px;
    padding: 2px 5px 0;
    vertical-align: middle;
    position: relative;
    top: -2px;
  }

  .subtitle {
    font-size: 11px;
    color: #888;
    margin: -8px 0 0 0;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
</style>
