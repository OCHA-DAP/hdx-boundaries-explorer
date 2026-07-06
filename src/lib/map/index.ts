import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { get } from "svelte/store";
import { fitCountryBounds, initLabelsToggle } from "./admin";
import {
  addAdminHoverInteraction,
  addClickInteraction,
  addHoverInteraction,
} from "./interactions/index";
import { createSpin } from "./spin";
import { mapStore, selectedIso3 } from "./store";
import MAP_STYLE from "./style";

export function initMap(container: HTMLDivElement): () => void {
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center: [20, 5],
    zoom: 3,
  });

  map.on("style.load", () => {
    map.setProjection({ type: "globe" });
  });

  // Idle globe spin, shown only until a country is picked or the user
  // touches the map — a one-way transition, since there's no "back to
  // overview" affordance once a country is selected.
  const spin = createSpin(() => map);
  let interacted = false;

  function stopSpinPermanently() {
    interacted = true;
    spin.stop();
  }

  map.once("load", () => {
    if (!interacted && !get(selectedIso3)) spin.start();
  });
  map.on("mousedown", stopSpinPermanently);
  map.on("touchstart", stopSpinPermanently);
  map.on("wheel", stopSpinPermanently);

  const unsubscribeSpin = selectedIso3.subscribe((iso3) => {
    if (iso3) stopSpinPermanently();
  });

  function handleVisibilityChange() {
    if (document.hidden) spin.stop();
    else if (!interacted && !get(selectedIso3)) spin.start();
  }
  document.addEventListener("visibilitychange", handleVisibilityChange);

  map.on("resize", () => {
    const iso3 = get(selectedIso3);
    if (iso3) fitCountryBounds(map, iso3);
  });

  mapStore.set(map);
  addHoverInteraction(map);
  addClickInteraction(map);
  addAdminHoverInteraction(map);
  initLabelsToggle(map);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    unsubscribeSpin();
    spin.stop();
    mapStore.set(null);
    map.remove();
    maplibregl.removeProtocol("pmtiles");
  };
}
