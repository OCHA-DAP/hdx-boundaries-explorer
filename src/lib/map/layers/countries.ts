import type maplibregl from 'maplibre-gl';

export const layers: maplibregl.LayerSpecification[] = [
  {
    id: 'countries-hover',
    type: 'fill',
    source: 'countries',
    'source-layer': 'bnda_cty',
    paint: {
      'fill-color': '#888888',
      'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.25, 0]
    }
  }
];
