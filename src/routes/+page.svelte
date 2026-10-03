<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import CountrySidebar from "$lib/components/CountrySidebar.svelte";
  import StatsPanel from "$lib/components/StatsPanel.svelte";
  import { initMap } from "$lib/map";
  import { applyView } from "$lib/map/admin";
  import { mapStore, selectedAdmin, selectedIso3, selectedSource } from "$lib/map/store";
  import { viewFromUrl } from "$lib/urlState";
  import type maplibregl from "maplibre-gl";
  import "maplibre-gl/dist/maplibre-gl.css";
  import { onMount, tick } from "svelte";

  let mapContainer: HTMLDivElement;
  let kiosk = $state(false);

  onMount(() => {
    const cleanup = initMap(mapContainer);

    function showView() {
      const view = viewFromUrl(location);
      const map = $mapStore;
      if (view.kiosk !== kiosk) {
        kiosk = view.kiosk;
        tick().then(() => map?.resize());
      }
      if (!map || map.loaded()) applyView(map, view);
      else map.once("load", () => applyView(map as maplibregl.Map, view));
    }

    showView();
    window.addEventListener("hashchange", showView);

    return () => {
      window.removeEventListener("hashchange", showView);
      cleanup();
    };
  });

  // Mirrors the selection into the query string so any view can be shared as a link.
  $effect(() => {
    const iso3 = $selectedIso3;
    const params = `country=${iso3}&source=${$selectedSource}&level=${$selectedAdmin}`;
    if (!iso3 || kiosk) return;
    goto(resolve(`/?${params}`), { replaceState: true, noScroll: true, keepFocus: true });
  });
</script>

<div class="app-shell">
  {#if !kiosk}
    <CountrySidebar />
  {/if}
  <div class="map-area">
    <div bind:this={mapContainer} class="map"></div>
    {#if !kiosk}
      <StatsPanel iso3={$selectedIso3} />
    {/if}
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
