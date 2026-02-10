<script lang="ts">
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { Protocol } from 'pmtiles';
  import { onMount } from 'svelte';

  let mapContainer: HTMLDivElement;

  onMount(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const map = new maplibregl.Map({
      container: mapContainer,
      style: {
        version: 8,
        sources: {
          land: {
            type: 'vector',
            url: 'pmtiles:///pmtiles/land_polygons.pmtiles'
          },
          countries: {
            type: 'vector',
            url: 'pmtiles:///pmtiles/bndy_cty.pmtiles',
            promoteId: { bnda_ctyfgb: 'objectid' }
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#a8d3ea' }
          },
          {
            id: 'land',
            type: 'fill',
            source: 'land',
            'source-layer': 'land_polygonsfgb',
            paint: { 'fill-color': '#f0ebe3' }
          },
          {
            id: 'countries-hover',
            type: 'fill',
            source: 'countries',
            'source-layer': 'bnda_ctyfgb',
            paint: {
              'fill-color': '#888888',
              'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.25, 0]
            }
          },
          {
            id: 'countries-outline',
            type: 'line',
            source: 'countries',
            'source-layer': 'bnda_ctyfgb',
            paint: {
              'line-color': '#aaaaaa',
              'line-width': 0.5
            }
          }
        ]
      },
      center: [0, 0],
      zoom: 3
    });

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });
    });

    let hoveredId: string | number | null = null;

    map.on('mousemove', 'countries-hover', (e) => {
      if (!e.features?.length) return;
      map.getCanvas().style.cursor = 'pointer';
      const id = e.features[0].id;
      if (id === hoveredId) return;
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: 'countries', sourceLayer: 'bnda_ctyfgb', id: hoveredId },
          { hover: false }
        );
      }
      hoveredId = id ?? null;
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: 'countries', sourceLayer: 'bnda_ctyfgb', id: hoveredId },
          { hover: true }
        );
      }
    });

    map.on('mouseleave', 'countries-hover', () => {
      map.getCanvas().style.cursor = '';
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: 'countries', sourceLayer: 'bnda_ctyfgb', id: hoveredId },
          { hover: false }
        );
      }
      hoveredId = null;
    });

    return () => {
      map.remove();
      maplibregl.removeProtocol('pmtiles');
    };
  });
</script>

<div bind:this={mapContainer} style="width: 100vw; height: 100vh;"></div>
