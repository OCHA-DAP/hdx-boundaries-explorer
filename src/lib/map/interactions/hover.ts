import type maplibregl from 'maplibre-gl';

export function addHoverInteraction(map: maplibregl.Map): void {
  let hoveredId: string | number | null = null;

  map.on('mousemove', 'countries-hover', (e) => {
    if (!e.features?.length) return;
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features[0].id;
    if (id === hoveredId) return;
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'bnda_cty', id: hoveredId },
        { hover: false }
      );
    }
    hoveredId = id ?? null;
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'bnda_cty', id: hoveredId },
        { hover: true }
      );
    }
  });

  map.on('mouseleave', 'countries-hover', () => {
    map.getCanvas().style.cursor = '';
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'bnda_cty', id: hoveredId },
        { hover: false }
      );
    }
    hoveredId = null;
  });
}
