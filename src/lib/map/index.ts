import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import type { Writable } from 'svelte/store';
import { initLabelsToggle } from './admin';
import {
  addAdminHoverInteraction,
  addClickInteraction,
  addHoverInteraction,
} from './interactions/index';
import MAP_STYLE from './style';
import { mapStore, selectedAdmin, selectedSource } from './store';

// Initialise the pmtiles protocol once for the lifetime of the app.
let protocolRegistered = false;
function ensureProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolRegistered = true;
}

export function initMap(
  container: HTMLDivElement,
  options?: {
    sourceStore?: Writable<string>;
    adminStore?: Writable<number>;
    mapStoreOverride?: Writable<maplibregl.Map | null>;
  },
): () => void {
  ensureProtocol();

  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center: [20, 5],
    zoom: 3,
  });

  map.on('style.load', () => {
    map.setProjection({ type: 'globe' });
  });

  const store = options?.mapStoreOverride ?? mapStore;
  const srcStore = options?.sourceStore ?? selectedSource;
  const admStore = options?.adminStore ?? selectedAdmin;

  store.set(map);
  addHoverInteraction(map);
  addClickInteraction(map, srcStore, admStore);
  addAdminHoverInteraction(map, srcStore, admStore);
  initLabelsToggle(map, srcStore, admStore);

  return () => {
    store.set(null);
    map.remove();
  };
}
