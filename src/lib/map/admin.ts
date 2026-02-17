import type maplibregl from 'maplibre-gl';
import { get } from 'svelte/store';
import { ADMIN_LEVELS } from './layers/admin';
import { selectedAdmin } from './store';

export function applyAdminFilter(map: maplibregl.Map, iso3: string): void {
  const level = get(selectedAdmin);
  for (const l of ADMIN_LEVELS) {
    const filter: maplibregl.FilterSpecification = ['==', ['get', 'iso3'], l === level ? iso3 : ''];
    map.setFilter(`adm${l}-fill`, filter);
    map.setFilter(`adm${l}-line`, filter);
  }
}
