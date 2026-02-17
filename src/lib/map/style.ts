import type maplibregl from 'maplibre-gl';
import { layers as adm1Layers } from './layers/adm1';
import { layers as countriesLayers } from './layers/countries';
import { layers as countryLineLayers } from './layers/country-lines';
import { layers as landLayers } from './layers/land';

const PMTILES_BASE =
  import.meta.env.VITE_PMTILES_BASE ?? 'https://hdx-boundaries-explorer.fieldmaps.io/pmtiles';

const pmtiles = (file: string) => `pmtiles://${PMTILES_BASE}/${file}`;

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    land: {
      type: 'vector',
      url: pmtiles('land_polygons.pmtiles')
    },
    countries: {
      type: 'vector',
      url: pmtiles('bnda_cty.pmtiles'),
      promoteId: { bnda_cty: 'objectid' }
    },
    'country-lines': {
      type: 'vector',
      url: pmtiles('bndl.pmtiles')
    },
    adm1: {
      type: 'vector',
      url: pmtiles('ocha_adm1.pmtiles')
    }
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#a8d3ea'
      }
    },
    ...landLayers,
    ...countriesLayers,
    ...countryLineLayers,
    ...adm1Layers
  ]
};

export default MAP_STYLE;
