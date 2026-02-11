import type maplibregl from 'maplibre-gl';

function getBoundsFromGeometry(
  geometry: GeoJSON.Geometry
): [number, number, number, number] | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;

  function processRings(coords: number[][][]) {
    for (const ring of coords) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  if (geometry.type === 'Polygon') {
    processRings(geometry.coordinates as number[][][]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates as number[][][][]) {
      processRings(polygon);
    }
  } else {
    return null;
  }

  return isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null;
}

export function addClickInteraction(map: maplibregl.Map): void {
  map.on('click', 'countries-hover', (e) => {
    if (!e.features?.length) return;
    const objectid = e.features[0].properties?.objectid;
    if (objectid == null) return;

    // Query all loaded tiles for this country to get the full extent
    const features = map.querySourceFeatures('countries', {
      sourceLayer: 'bnda_ctyfgb',
      filter: ['==', ['get', 'objectid'], objectid]
    });

    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;

    for (const feature of features) {
      const bounds = getBoundsFromGeometry(feature.geometry);
      if (!bounds) continue;
      const [w, s, e, n] = bounds;
      if (w < minLng) minLng = w;
      if (s < minLat) minLat = s;
      if (e > maxLng) maxLng = e;
      if (n > maxLat) maxLat = n;
    }

    if (!isFinite(minLng)) return;

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat]
      ],
      { padding: 50 }
    );
  });
}
