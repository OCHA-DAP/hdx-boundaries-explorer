import type maplibregl from 'maplibre-gl';

export function syncMaps(map1: maplibregl.Map, map2: maplibregl.Map): () => void {
  let syncing = false;

  function sync(source: maplibregl.Map, target: maplibregl.Map) {
    return () => {
      if (syncing) return;
      syncing = true;
      target.jumpTo({
        center: source.getCenter(),
        zoom: source.getZoom(),
        bearing: source.getBearing(),
        pitch: source.getPitch(),
      });
      syncing = false;
    };
  }

  const onMove1 = sync(map1, map2);
  const onMove2 = sync(map2, map1);
  map1.on('move', onMove1);
  map2.on('move', onMove2);

  return () => {
    map1.off('move', onMove1);
    map2.off('move', onMove2);
  };
}
