import type maplibregl from 'maplibre-gl';

export const ADMIN_LEVELS = [1, 2, 3, 4] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export function adminLayers(level: AdminLevel): maplibregl.LayerSpecification[] {
  const source = `adm${level}`;
  const sourceLayer = `ocha_adm${level}`;
  return [
    {
      id: `adm${level}-fill`,
      type: 'fill',
      source,
      'source-layer': sourceLayer,
      filter: ['==', ['get', 'iso3'], ''],
      paint: {
        'fill-color': '#4a90d9',
        'fill-opacity': 0.15
      }
    },
    {
      id: `adm${level}-line`,
      type: 'line',
      source,
      'source-layer': sourceLayer,
      filter: ['==', ['get', 'iso3'], ''],
      paint: {
        'line-color': '#2060a0',
        'line-width': 1
      }
    }
  ];
}
