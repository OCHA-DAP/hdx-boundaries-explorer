<script lang="ts">
  import { page } from "$app/state";
  import CountrySidebar from "$lib/components/CountrySidebar.svelte";
  import StatsPanel from "$lib/components/StatsPanel.svelte";
  import { initMap } from "$lib/map";
  import { selectCountry } from "$lib/map/admin";
  import { mapStore, selectedIso3 } from "$lib/map/store";
  import "maplibre-gl/dist/maplibre-gl.css";
  import { onMount } from "svelte";

  let mapContainer: HTMLDivElement;

  onMount(() => {
    const cleanup = initMap(mapContainer);
    const initialIso3 = page.url.searchParams.get("country") ?? "";

    const unsubscribe = mapStore.subscribe((map) => {
      if (!map || !initialIso3) return;
      if (map.loaded()) {
        selectCountry(map, initialIso3);
      } else {
        map.once("load", () => selectCountry(map, initialIso3));
      }
    });

    return () => {
      unsubscribe();
      cleanup();
    };
  });
</script>

<div class="app-shell">
  <CountrySidebar />
  <div class="map-area">
    <div bind:this={mapContainer} class="map"></div>
    <StatsPanel iso3={$selectedIso3} />
  </div>
</div>

<style>
  :global(.feature-tooltip .maplibregl-popup-content) {
    padding: 6px 10px;
    font-family: sans-serif;
    font-size: 13px;
    background: rgba(0, 0, 0, 1);
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

  :global(.feature-tooltip .feature-tooltip-props) {
    margin-top: 6px;
    border-collapse: collapse;
    width: 100%;
  }

  :global(.feature-tooltip .feature-tooltip-key) {
    color: rgba(255, 255, 255, 0.45);
    font-size: 10px;
    padding-right: 8px;
    vertical-align: top;
    white-space: nowrap;
  }

  :global(.feature-tooltip .feature-tooltip-val) {
    color: rgba(255, 255, 255, 0.9);
    font-size: 10px;
    vertical-align: top;
    word-break: break-all;
  }

  .app-shell {
    display: flex;
    width: 100vw;
    height: 100vh;
  }

  .map-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    height: 100%;
  }

  .map {
    flex: 1;
    min-height: 0;
    width: 100%;
  }
</style>
