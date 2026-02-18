import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { initLabelsToggle } from './admin';
import {
  addAdminHoverInteraction,
  addClickInteraction,
  addHoverInteraction,
} from './interactions/index';
import MAP_STYLE from './style';
import { mapStore } from './store';

export function initMap(container: HTMLDivElement): () => void {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center: [20, 5],
    zoom: 3,
  });

  map.on('style.load', () => {
    map.setProjection({ type: 'globe' });
  });

  mapStore.set(map);
  addHoverInteraction(map);
  addClickInteraction(map);
  addAdminHoverInteraction(map);
  initLabelsToggle(map);

  return () => {
    mapStore.set(null);
    map.remove();
    maplibregl.removeProtocol('pmtiles');
  };
}
