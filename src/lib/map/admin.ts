import { getBboxForIso3 } from "$lib/parquet/bbox";
import { getStatsForCountry } from "$lib/parquet/sourceStats";
import { ADMIN_SOURCES, getLevelsForSource } from "$lib/sources";
import type maplibregl from "maplibre-gl";
import { get } from "svelte/store";
import { labelsEnabled, selectedAdmin, selectedIso3, selectedSource } from "./store";

// Resolves which level to show for a source/country: keeps `level` if that
// source actually has data at that level for this country, otherwise falls
// back to the deepest level that does (or the source's deepest configured
// level if it has no data at all).
async function pickLevel(iso3: string, source: string, level: number): Promise<number> {
  const levels = getLevelsForSource(source);
  if (levels.length === 0) return level;

  const stats = await getStatsForCountry(iso3);
  const hasData = (l: number) =>
    stats.some((s) => s.source === source && s.level === l && s.featureCount > 0);

  if (levels.includes(level as (typeof levels)[number]) && hasData(level)) return level;
  return [...levels].reverse().find(hasData) ?? levels[levels.length - 1];
}

// Sets the selected country, fits the map to its bbox, and applies the current
// source/level filter (resolving to a level with data for this country).
// Shared by CountrySidebar's row clicks and the page's initial ?country=
// query-param handling so both go through the same sequence.
export async function selectCountry(map: maplibregl.Map | null, iso3: string): Promise<void> {
  selectedIso3.set(iso3);
  if (!iso3) return;

  const [bbox, level] = await Promise.all([
    getBboxForIso3(iso3),
    pickLevel(iso3, get(selectedSource), get(selectedAdmin)),
  ]);
  selectedAdmin.set(level);

  if (!bbox) return;
  if (!map) return;

  applyAdminFilter(map, iso3);

  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    { padding: 50 },
  );
}

// Switches to a source, keeping the current admin level if it has data for
// this country, otherwise falling back to the deepest level that does. Used
// by CountrySidebar's [ ]-keyboard cycling and StatsComparisonTable's row
// clicks.
export async function selectSource(
  map: maplibregl.Map | null,
  iso3: string,
  source: string,
): Promise<void> {
  selectedSource.set(source);

  if (iso3) {
    selectedAdmin.set(await pickLevel(iso3, source, get(selectedAdmin)));
  }

  if (!map || !iso3) return;
  applyAdminFilter(map, iso3);
}

// Switches to an exact source/level pair. Used by StatsComparisonTable's cell
// clicks, where the level is already known to be valid for the source.
export function selectSourceLevel(
  map: maplibregl.Map | null,
  iso3: string,
  source: string,
  level: number,
): void {
  selectedSource.set(source);
  selectedAdmin.set(level);

  if (!map || !iso3) return;
  applyAdminFilter(map, iso3);
}

let cancelPendingHide: (() => void) | null = null;

export function applyAdminFilter(map: maplibregl.Map, iso3: string): void {
  const activeLevel = get(selectedAdmin);
  const activeSource = get(selectedSource);
  const showLabels = get(labelsEnabled);

  // Cancel any in-progress hide from a previous switch
  if (cancelPendingHide) {
    cancelPendingHide();
    cancelPendingHide = null;
  }

  // Immediately show the new active layer (kicks off tile loading)
  for (const src of ADMIN_SOURCES) {
    for (const l of src.levels) {
      if (src.id === activeSource && l === activeLevel) {
        map.setLayoutProperty(`${src.id}-adm${l}-fill`, "visibility", "visible");
        map.setLayoutProperty(`${src.id}-adm${l}-hover`, "visibility", "visible");
        map.setLayoutProperty(`${src.id}-adm${l}-line`, "visibility", "visible");
        map.setLayoutProperty(
          `${src.id}-adm${l}-label`,
          "visibility",
          showLabels ? "visible" : "none",
        );
        map.setFilter(`${src.id}-adm${l}-fill`, [
          "==",
          ["slice", ["get", src.countryCodeField], 0, 3],
          iso3,
        ]);
        map.setFilter(`${src.id}-adm${l}-hover`, ["==", ["get", src.countryCodeField], ""]);
        map.setFilter(`${src.id}-adm${l}-line`, [
          "==",
          ["slice", ["get", src.countryCodeField], 0, 3],
          iso3,
        ]);
        map.setFilter(`${src.id}-adm${l}-label`, [
          "==",
          ["slice", ["get", src.countryCodeField], 0, 3],
          iso3,
        ]);
      }
    }
  }

  // Hide old layers the moment the new source's tiles are ready
  const newSourceId = `${activeSource}-adm${activeLevel}`;

  const onRender = () => {
    if (!map.isSourceLoaded(newSourceId)) return;

    for (const src of ADMIN_SOURCES) {
      for (const l of src.levels) {
        if (src.id !== activeSource || l !== activeLevel) {
          map.setLayoutProperty(`${src.id}-adm${l}-fill`, "visibility", "none");
          map.setLayoutProperty(`${src.id}-adm${l}-hover`, "visibility", "none");
          map.setLayoutProperty(`${src.id}-adm${l}-line`, "visibility", "none");
          map.setLayoutProperty(`${src.id}-adm${l}-label`, "visibility", "none");
          map.setFilter(`${src.id}-adm${l}-fill`, ["==", ["get", src.countryCodeField], ""]);
          map.setFilter(`${src.id}-adm${l}-hover`, ["==", ["get", src.countryCodeField], ""]);
          map.setFilter(`${src.id}-adm${l}-line`, ["==", ["get", src.countryCodeField], ""]);
          map.setFilter(`${src.id}-adm${l}-label`, ["==", ["get", src.countryCodeField], ""]);
        }
      }
    }

    map.off("render", onRender);
    cancelPendingHide = null;
  };

  map.on("render", onRender);
  cancelPendingHide = () => map.off("render", onRender);
}

export function initLabelsToggle(map: maplibregl.Map): void {
  labelsEnabled.subscribe((enabled) => {
    const iso3 = get(selectedIso3);
    if (!iso3) return;
    const activeSource = get(selectedSource);
    const activeLevel = get(selectedAdmin);
    map.setLayoutProperty(
      `${activeSource}-adm${activeLevel}-label`,
      "visibility",
      enabled ? "visible" : "none",
    );
  });
}
