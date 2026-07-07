import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { selectCountry } from "$lib/map/admin";
import { selectedIso3 } from "$lib/map/store";
import type maplibregl from "maplibre-gl";
import { get } from "svelte/store";

export function addClickInteraction(map: maplibregl.Map): void {
  map.on("click", "countries-hover", (e) => {
    if (!e.features?.length) return;

    const iso3: string | undefined = e.features[0].properties?.iso3cd;
    if (!iso3 || iso3 === get(selectedIso3)) return;

    selectCountry(map, iso3);
    goto(resolve(`/?country=${iso3}`), { replaceState: true, noScroll: true, keepFocus: true });
  });
}
