import type maplibregl from 'maplibre-gl';

export const layers: maplibregl.LayerSpecification[] = [
  {
    id: 'adm1-fill',
    type: 'fill',
    source: 'adm1',
    'source-layer': 'ocha_adm1',
    filter: ['==', ['get', 'iso3'], ''],
    paint: {
      'fill-color': '#4a90d9',
      'fill-opacity': 0.15
    }
  },
  {
    id: 'adm1-line',
    type: 'line',
    source: 'adm1',
    'source-layer': 'ocha_adm1',
    filter: ['==', ['get', 'iso3'], ''],
    paint: {
      'line-color': '#2060a0',
      'line-width': 1
    }
  }
];
