import type maplibregl from 'maplibre-gl';

export const ADMIN_LEVELS = [1, 2, 3, 4, 5] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export function adminLayersForSource(
  sourceId: string,
  level: AdminLevel
): maplibregl.LayerSpecification[] {
  const source = `${sourceId}-adm${level}`;
  const sourceLayer = `${sourceId}_adm${level}`;
  return [
    {
      id: `${sourceId}-adm${level}-fill`,
      type: 'fill',
      source,
      'source-layer': sourceLayer,
      filter: ['==', ['get', 'iso3'], ''],
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#4a90d9', 'fill-opacity': 0.15 }
    },
    {
      id: `${sourceId}-adm${level}-line`,
      type: 'line',
      source,
      'source-layer': sourceLayer,
      filter: ['==', ['get', 'iso3'], ''],
      layout: { visibility: 'none' },
      paint: { 'line-color': '#2060a0', 'line-width': 1 }
    }
  ];
}
