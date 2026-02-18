import type maplibregl from 'maplibre-gl';

export const layers: maplibregl.LayerSpecification[] = [
  {
    id: 'land',
    type: 'fill',
    source: 'land',
    'source-layer': 'osm_land',
    paint: { 'fill-color': '#f0ebe3' },
  },
];
