import { applyAdminFilter } from "$lib/map/admin";
import { selectedIso3 } from "$lib/map/store";
import { getBboxForIso3 } from "$lib/parquet/bbox";
import type maplibregl from "maplibre-gl";
import { get } from "svelte/store";

export function addClickInteraction(map: maplibregl.Map): void {
  map.on("click", "countries-hover", async (e) => {
    if (!e.features?.length) return;

    const iso3: string | undefined = e.features[0].properties?.iso3cd;
    if (!iso3 || iso3 === get(selectedIso3)) return;

    selectedIso3.set(iso3);
    applyAdminFilter(map, iso3);

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
