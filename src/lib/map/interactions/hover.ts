import maplibregl from 'maplibre-gl';
import { get } from 'svelte/store';
import { ADMIN_SOURCES } from '$lib/sources';
import { labelsEnabled, selectedAdmin, selectedIso3, selectedSource } from '$lib/map/store';

export function addHoverInteraction(map: maplibregl.Map): void {
  let hoveredId: string | number | null = null;
  let hoveredIso3: string | null = null;

  function clearHover() {
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'bnda_cty', id: hoveredId },
        { hover: false },
      );
    }
    hoveredId = null;
    hoveredIso3 = null;
  }

  // When a country is selected, remove any hover highlight from it.
  selectedIso3.subscribe((iso3) => {
    if (hoveredIso3 === iso3) clearHover();
  });

  map.on('mousemove', 'countries-hover', (e) => {
    if (!e.features?.length) return;
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features[0].id;
    if (id === hoveredId) return;
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'bnda_cty', id: hoveredId },
        { hover: false },
      );
    }
    const iso3: string | null = e.features[0].properties?.iso3cd ?? null;
    // Don't darken the currently selected country on hover.
    if (iso3 && iso3 === get(selectedIso3)) {
      hoveredId = null;
      hoveredIso3 = null;
      return;
    }
    hoveredId = id ?? null;
    hoveredIso3 = iso3;
    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'bnda_cty', id: hoveredId },
        { hover: true },
      );
    }
  });

  map.on('mouseleave', 'countries-hover', () => {
    map.getCanvas().style.cursor = '';
    clearHover();
  });
}

function buildPopupHtml(
  props: Record<string, unknown>,
  src: (typeof ADMIN_SOURCES)[number],
  level: number,
): string | null {
  const nameField = src.nameField.replace('{level}', String(level));
  const codeField = src.codeField.replace('{level}', String(level));
  const name = props[nameField];
  if (!name) return null;
  const code = props[codeField];
  return code
    ? `${String(name)}<br><span class="feature-tooltip-code">${String(code)}</span>`
    : String(name);
}

export function addAdminHoverInteraction(map: maplibregl.Map): void {
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'feature-tooltip',
    maxWidth: '260px',
  });

  let lastPoint: maplibregl.Point | null = null;
  let lastLngLat: maplibregl.LngLat | null = null;

  selectedAdmin.subscribe(() => {
    popup.remove();
    lastPoint = null;
    lastLngLat = null;
  });

  labelsEnabled.subscribe((enabled) => {
    if (enabled) popup.remove();
  });

  selectedSource.subscribe((newSource) => {
    if (!lastPoint || !lastLngLat || get(labelsEnabled)) return;

    const level = get(selectedAdmin);
    const srcDef = ADMIN_SOURCES.find((s) => s.id === newSource);
    if (!srcDef) return;

    const layerId = `${newSource}-adm${level}-fill`;
    const sourceId = `${newSource}-adm${level}`;
    const point = lastPoint;
    const lngLat = lastLngLat;

    const tryUpdate = () => {
      const features = map.queryRenderedFeatures(point, { layers: [layerId] });
      if (!features.length) return false;
      const html = buildPopupHtml(features[0].properties ?? {}, srcDef, level);
      if (!html) {
        popup.remove();
        return true;
      }
      popup.setLngLat(lngLat).setHTML(html).addTo(map);
      return true;
    };

    if (tryUpdate()) return;

    const onRender = () => {
      if (!map.isSourceLoaded(sourceId)) return;
      map.off('render', onRender);
      tryUpdate();
    };
    map.on('render', onRender);
  });

  for (const src of ADMIN_SOURCES) {
    for (const level of src.levels) {
      const layerId = `${src.id}-adm${level}-fill`;

      map.on('mousemove', layerId, (e) => {
        if (!e.features?.length) return;
        lastPoint = e.point;
        lastLngLat = e.lngLat;
        if (get(labelsEnabled)) return;
        const html = buildPopupHtml(e.features[0].properties ?? {}, src, level);
        if (!html) return;
        map.getCanvas().style.cursor = 'pointer';
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
        lastPoint = null;
        lastLngLat = null;
      });
    }
  }
}
