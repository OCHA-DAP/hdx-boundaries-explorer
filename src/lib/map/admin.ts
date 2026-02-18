import { ADMIN_SOURCES } from '$lib/sources';
import type maplibregl from 'maplibre-gl';
import { get } from 'svelte/store';
import { labelsEnabled, selectedAdmin, selectedIso3, selectedSource } from './store';

let cancelPendingHide: (() => void) | null = null;

export function applyAdminFilter(map: maplibregl.Map, iso3: string): void {
  const activeLevel = get(selectedAdmin);
  const activeSource = get(selectedSource);
  const showLabels = get(labelsEnabled);

  // Cancel any in-progress hide from a previous switch
  if (cancelPendingHide) {
    cancelPendingHide();
    cancelPendingHide = null;
  }

  // Immediately show the new active layer (kicks off tile loading)
  for (const src of ADMIN_SOURCES) {
    for (const l of src.levels) {
      if (src.id === activeSource && l === activeLevel) {
        map.setLayoutProperty(`${src.id}-adm${l}-fill`, 'visibility', 'visible');
        map.setLayoutProperty(`${src.id}-adm${l}-hover`, 'visibility', 'visible');
        map.setLayoutProperty(`${src.id}-adm${l}-line`, 'visibility', 'visible');
        map.setLayoutProperty(
          `${src.id}-adm${l}-label`,
          'visibility',
          showLabels ? 'visible' : 'none',
        );
        map.setFilter(`${src.id}-adm${l}-fill`, ['==', ['get', src.countryCodeField], iso3]);
        map.setFilter(`${src.id}-adm${l}-hover`, ['==', ['get', src.countryCodeField], '']);
        map.setFilter(`${src.id}-adm${l}-line`, ['==', ['get', src.countryCodeField], iso3]);
        map.setFilter(`${src.id}-adm${l}-label`, ['==', ['get', src.countryCodeField], iso3]);
      }
    }
  }

  // Hide old layers the moment the new source's tiles are ready
  const newSourceId = `${activeSource}-adm${activeLevel}`;

  const onRender = () => {
    if (!map.isSourceLoaded(newSourceId)) return;

    for (const src of ADMIN_SOURCES) {
      for (const l of src.levels) {
        if (src.id !== activeSource || l !== activeLevel) {
          map.setLayoutProperty(`${src.id}-adm${l}-fill`, 'visibility', 'none');
          map.setLayoutProperty(`${src.id}-adm${l}-hover`, 'visibility', 'none');
          map.setLayoutProperty(`${src.id}-adm${l}-line`, 'visibility', 'none');
          map.setLayoutProperty(`${src.id}-adm${l}-label`, 'visibility', 'none');
          map.setFilter(`${src.id}-adm${l}-fill`, ['==', ['get', src.countryCodeField], '']);
          map.setFilter(`${src.id}-adm${l}-hover`, ['==', ['get', src.countryCodeField], '']);
          map.setFilter(`${src.id}-adm${l}-line`, ['==', ['get', src.countryCodeField], '']);
          map.setFilter(`${src.id}-adm${l}-label`, ['==', ['get', src.countryCodeField], '']);
        }
      }
    }

    map.off('render', onRender);
    cancelPendingHide = null;
  };

  map.on('render', onRender);
  cancelPendingHide = () => map.off('render', onRender);
}

export function initLabelsToggle(map: maplibregl.Map): void {
  labelsEnabled.subscribe((enabled) => {
    const iso3 = get(selectedIso3);
    if (!iso3) return;
    const activeSource = get(selectedSource);
    const activeLevel = get(selectedAdmin);
    map.setLayoutProperty(
      `${activeSource}-adm${activeLevel}-label`,
      'visibility',
      enabled ? 'visible' : 'none',
    );
  });
}
