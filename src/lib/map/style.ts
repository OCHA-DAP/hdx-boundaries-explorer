import type maplibregl from 'maplibre-gl';

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    land: {
      type: 'vector',
      url: 'pmtiles://https://hdx-boundaries-explorer.fieldmaps.io/pmtiles/land_polygons.pmtiles'
    },
    countries: {
      type: 'vector',
      url: 'pmtiles://https://hdx-boundaries-explorer.fieldmaps.io/pmtiles/bndy_cty.pmtiles',
      promoteId: { bnda_ctyfgb: 'objectid' }
    },
    'country-lines': {
      type: 'vector',
      url: 'pmtiles://https://hdx-boundaries-explorer.fieldmaps.io/pmtiles/bndl.pmtiles'
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
      id: 'country-lines',
      type: 'line',
      source: 'country-lines',
      'source-layer': 'bndlfgb',
      filter: ['==', ['get', 'bdytyp'], '1'],
      paint: {
        'line-color': '#aaaaaa',
        'line-width': 0.75
      }
    },
    {
      id: 'country-lines-disputed',
      type: 'line',
      source: 'country-lines',
      'source-layer': 'bndlfgb',
      filter: ['in', ['get', 'bdytyp'], ['literal', ['2', '3', '4']]],
      paint: {
        'line-color': '#aaaaaa',
        'line-width': 0.75,
        'line-dasharray': [4, 3]
      }
    },
    {
      id: 'country-lines-other',
      type: 'line',
      source: 'country-lines',
      'source-layer': 'bndlfgb',
      filter: ['in', ['get', 'bdytyp'], ['literal', ['8', '9', '99']]],
      paint: {
        'line-color': '#bbbbbb',
        'line-width': 0.5,
        'line-dasharray': [2, 2]
      }
    }
  ]
};

export default MAP_STYLE;
