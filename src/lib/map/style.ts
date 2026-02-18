import { ADMIN_SOURCES } from '$lib/sources';
import type maplibregl from 'maplibre-gl';
import { adminLayersForSource } from './layers/admin';
import { layers as countriesLayers } from './layers/countries';
import { layers as countryLineLayers } from './layers/country-lines';
import { layers as landLayers } from './layers/land';

const PMTILES_BASE =
  import.meta.env.VITE_PMTILES_BASE ?? 'https://hdx-boundaries-explorer.fieldmaps.io/pmtiles';

const pmtiles = (file: string) => `pmtiles://${PMTILES_BASE}/${file}`;

const admSources = Object.fromEntries(
  ADMIN_SOURCES.flatMap((src) =>
    src.levels.flatMap((l) => [
      [`${src.id}-adm${l}`, { type: 'vector' as const, url: pmtiles(`${src.id}_adm${l}.pmtiles`) }],
      [
        `${src.id}-adm${l}-labels`,
        { type: 'vector' as const, url: pmtiles(`${src.id}_adm${l}_labels.pmtiles`) },
      ],
    ]),
  ),
);

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    land: {
      type: 'vector',
      url: pmtiles('osm_land.pmtiles'),
    },
    countries: {
      type: 'vector',
      url: pmtiles('salb_adm0.pmtiles'),
      promoteId: { salb_adm0: 'objectid' },
    },
    'country-lines': {
      type: 'vector',
      url: pmtiles('salb_lines.pmtiles'),
    },
    ...admSources,
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#a8d3ea' },
    },
    ...landLayers,
    ...countriesLayers,
    ...countryLineLayers,
    ...ADMIN_SOURCES.flatMap((src) =>
      src.levels.flatMap((l) =>
        adminLayersForSource(
          src.id,
          l,
          src.nameField.replace('{level}', String(l)),
          src.codeField.replace('{level}', String(l)),
          src.countryCodeField,
        ),
      ),
    ),
  ],
};

export default MAP_STYLE;
