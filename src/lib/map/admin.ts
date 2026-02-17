import type maplibregl from 'maplibre-gl';
import { get } from 'svelte/store';
import { ADMIN_SOURCES } from '$lib/sources';
import { selectedAdmin, selectedSource } from './store';

export function applyAdminFilter(map: maplibregl.Map, iso3: string): void {
  const activeLevel = get(selectedAdmin);
  const activeSource = get(selectedSource);

  for (const src of ADMIN_SOURCES) {
    for (const l of src.levels) {
      const isActive = src.id === activeSource && l === activeLevel;
      const visibility = isActive ? 'visible' : 'none';
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'iso3'], isActive ? iso3 : ''];
      map.setLayoutProperty(`${src.id}-adm${l}-fill`, 'visibility', visibility);
      map.setLayoutProperty(`${src.id}-adm${l}-line`, 'visibility', visibility);
      map.setFilter(`${src.id}-adm${l}-fill`, filter);
      map.setFilter(`${src.id}-adm${l}-line`, filter);
    }
  }
}
