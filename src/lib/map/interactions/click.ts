import { getBboxForIso3 } from '$lib/parquet/bbox';
import { applyAdminFilter } from '$lib/map/admin';
import { selectedAdmin, selectedIso3, selectedSource } from '$lib/map/store';
import type { Readable } from 'svelte/store';
import { get } from 'svelte/store';
import type maplibregl from 'maplibre-gl';

export function addClickInteraction(
  map: maplibregl.Map,
  sourceStore: Readable<string> = selectedSource,
  adminStore: Readable<number> = selectedAdmin,
): void {
  map.on('click', 'countries-hover', async (e) => {
    if (!e.features?.length) return;

    const iso3: string | undefined = e.features[0].properties?.iso3cd;
    if (!iso3 || iso3 === get(selectedIso3)) return;

    selectedIso3.set(iso3);
    applyAdminFilter(map, iso3, get(sourceStore), get(adminStore));

    const bbox = await getBboxForIso3(iso3);
    if (!bbox) return;

    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 50 },
    );
  });
}
