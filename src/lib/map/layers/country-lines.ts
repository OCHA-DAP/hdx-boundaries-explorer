import type maplibregl from 'maplibre-gl';

export const layers: maplibregl.LayerSpecification[] = [
  {
    id: 'country-lines',
    type: 'line',
    source: 'country-lines',
    'source-layer': 'bndl',
    filter: ['==', ['get', 'bdytyp'], '1'],
    paint: {
      'line-color': '#aaaaaa',
      'line-width': 0.75,
    },
  },
  {
    id: 'country-lines-disputed',
    type: 'line',
    source: 'country-lines',
    'source-layer': 'bndl',
    filter: ['in', ['get', 'bdytyp'], ['literal', ['2', '3', '4']]],
    paint: {
      'line-color': '#aaaaaa',
      'line-width': 0.75,
      'line-dasharray': [4, 3],
    },
  },
  {
    id: 'country-lines-other',
    type: 'line',
    source: 'country-lines',
    'source-layer': 'bndl',
    filter: ['in', ['get', 'bdytyp'], ['literal', ['8', '9', '99']]],
    paint: {
      'line-color': '#bbbbbb',
      'line-width': 0.5,
      'line-dasharray': [2, 2],
    },
  },
];
