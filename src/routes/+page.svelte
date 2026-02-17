<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import { initMap } from '$lib/map';
  import Panel from '$lib/components/Panel.svelte';
  import CountrySelect from '$lib/components/CountrySelect.svelte';
  import AdminSelect from '$lib/components/AdminSelect.svelte';
  import SourceSelect from '$lib/components/SourceSelect.svelte';

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
  </Panel>
</div>

<style>
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
