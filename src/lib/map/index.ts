import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { addClickInteraction, addHoverInteraction } from './interactions/index';
import MAP_STYLE from './style';

export function initMap(container: HTMLDivElement): () => void {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center: [20, 5],
    zoom: 3
  });

  map.on('style.load', () => {
    map.setProjection({ type: 'globe' });
  });

  addHoverInteraction(map);
  addClickInteraction(map);

  return () => {
    map.remove();
    maplibregl.removeProtocol('pmtiles');
  };
}
