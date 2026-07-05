import { ADMIN_SOURCES } from "$lib/sources";
import type maplibregl from "maplibre-gl";
import positron from "./basemap/positron.json";
import { adminLayersForSource } from "./layers/admin";
import { layers as countriesLayers } from "./layers/countries";
import { layers as countryLineLayers } from "./layers/country-lines";

const PMTILES_BASE =
  import.meta.env.VITE_PMTILES_BASE ?? "https://hdx-boundaries-explorer.fieldmaps.io/pmtiles";

const pmtiles = (file: string) => `pmtiles://${PMTILES_BASE}/${file}`;

const admSources = Object.fromEntries(
  ADMIN_SOURCES.flatMap((src) =>
    src.levels.flatMap((l) => [
      [
        `${src.id}-adm${l}`,
        {
          type: "vector" as const,
          url: pmtiles(`${src.id}_adm${l}.pmtiles`),
          // hover_id (iso3 + admin code, computed at download time) groups
          // multi-polygon admin units — e.g. archipelagos split across many
          // rows sharing one code — under a single feature id for hover.
          promoteId: { [`${src.id}_adm${l}`]: "hover_id" },
        },
      ],
      [
        `${src.id}-adm${l}-labels`,
        { type: "vector" as const, url: pmtiles(`${src.id}_adm${l}_labels.pmtiles`) },
      ],
    ]),
  ),
);

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sprite: positron.sprite,
  glyphs: positron.glyphs,
  sources: {
    ...(positron.sources as maplibregl.StyleSpecification["sources"]),
    countries: {
      type: "vector",
      url: pmtiles("salb_adm0.pmtiles"),
      promoteId: { salb_adm0: "objectid" },
    },
    "country-lines": {
      type: "vector",
      url: pmtiles("salb_lines.pmtiles"),
    },
    ...admSources,
  },
  layers: [
    ...(positron.layers as maplibregl.LayerSpecification[]),
    ...countriesLayers,
    ...countryLineLayers,
    ...ADMIN_SOURCES.flatMap((src) =>
      src.levels.flatMap((l) =>
        adminLayersForSource(
          src.id,
          l,
          src.nameField.replace("{level}", String(l)),
          src.codeField.replace("{level}", String(l)),
          src.countryCodeField,
        ),
      ),
    ),
  ],
};

export default MAP_STYLE;
