import type maplibregl from 'maplibre-gl';

export const layers: maplibregl.LayerSpecification[] = [
  {
    id: 'land',
    type: 'fill',
    source: 'land',
    'source-layer': 'land_polygons',
    paint: { 'fill-color': '#f0ebe3' }
  }
];
