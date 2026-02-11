<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import { initMap } from '$lib/map';

  let mapContainer: HTMLDivElement;

  onMount(() => initMap(mapContainer));
</script>

<div bind:this={mapContainer} style="width: 100vw; height: 100vh;"></div>
