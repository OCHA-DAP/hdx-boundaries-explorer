import { selectedIso3 } from '$lib/map/store';
import maplibregl from 'maplibre-gl';
import { get } from 'svelte/store';

export function addHoverInteraction(map: maplibregl.Map): void {
  let hoveredId: string | number | null = null;
  let hoveredIso3: string | null = null;

  function clearHover() {
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'salb_adm0', id: hoveredId },
        { hover: false },
      );
    }
    hoveredId = null;
    hoveredIso3 = null;
  }

  // When a country is selected, remove any hover highlight from it.
  selectedIso3.subscribe((iso3) => {
    if (hoveredIso3 === iso3) clearHover();
  });

  map.on('mousemove', 'countries-hover', (e) => {
    if (!e.features?.length) return;
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features[0].id;
    if (id === hoveredId) return;
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'salb_adm0', id: hoveredId },
        { hover: false },
      );
    }
    const iso3: string | null = e.features[0].properties?.iso3cd ?? null;
    // Don't darken the currently selected country on hover.
    if (iso3 && iso3 === get(selectedIso3)) {
      hoveredId = null;
      hoveredIso3 = null;
      return;
    }
    hoveredId = id ?? null;
    hoveredIso3 = iso3;
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'salb_adm0', id: hoveredId },
        { hover: true },
      );
    }
  });

  map.on('mouseleave', 'countries-hover', () => {
    map.getCanvas().style.cursor = '';
    clearHover();
  });
}
