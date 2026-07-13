import type { AdminLevel } from "$lib/map/layers/admin";

export const ADMIN_SOURCES = [
  {
    id: "ocha",
    label: "OCHA",
    levels: [1, 2, 3, 4] as AdminLevel[],
    nameField: "adm{level}_name",
    codeField: "adm{level}_pcode",
    countryCodeField: "iso3",
  },
  {
    id: "wfp",
    label: "WFP",
    levels: [1, 2, 3, 4] as AdminLevel[],
    nameField: "adm{level}_name",
    codeField: "source_id",
    countryCodeField: "iso3",
    // "Under National Administration" is a filler polygon standing in for
    // areas without a real admin unit — mostly lakes/seas, but also at least
    // one non-water case (the Korea DMZ) — not a genuine subdivision either
    // way. "N/A"/"Undefined" are the same idea: a polygon with no real name
    // attached isn't usable, differentiated admin data, whether it covers a
    // single sliver or (for some small territories) 100% of that country's
    // rows at this level — showing nothing is preferable to a fake unit.
    junkNameField: "adm{level}_name",
    junkNameValues: ["Under National Administration", "N/A", "Undefined"],
  },
  {
    id: "unicef",
    label: "UNICEF",
    levels: [1, 2, 3, 4] as AdminLevel[],
    nameField: "name",
    codeField: "Source_ID",
    countryCodeField: "adm0_ucode",
    // Same filler convention as WFP (see above).
    junkNameField: "name",
    junkNameValues: ["Under National Administration", "N/A", "Undefined"],
    // Hand-picked exact-match names for polygons carried as literal named
    // features rather than routed through a placeholder — never a
    // substring/keyword match, since e.g. "Lake Placid" (a real NY region)
    // would false-positive on any generic "lake" pattern. Verified per name:
    // Burundi's adm2 "Lake Tanganyika" traces the lake shoreline exactly.
    namedWaterBodies: ["Lake Tanganyika"],
  },
  {
    id: "unhcr",
    label: "UNHCR",
    levels: [1, 2] as AdminLevel[],
    nameField: "gis_name",
    codeField: "adm{level}_source_code",
    countryCodeField: "iso3",
  },
  {
    id: "fao",
    label: "FAO",
    levels: [1, 2] as AdminLevel[],
    nameField: "GAUL{level}_NAME",
    codeField: "GAUL{level}_CODE",
    countryCodeField: "ISO3_CODE",
    // Same filler convention as WFP/UNICEF (see above). "Administrative Unit
    // Not Available" is FAO's own no-name-data placeholder — same as "N/A"
    // elsewhere, including several small territories where it's 100% of that
    // territory's rows at this level.
    junkNameField: "GAUL{level}_NAME",
    junkNameValues: ["Waterbody", "Undefined", "Administrative Unit Not Available"],
  },
  {
    id: "salb",
    label: "SALB",
    levels: [1, 2] as AdminLevel[],
    nameField: "adm{level}nm",
    codeField: "adm{level}cd",
    countryCodeField: "iso3cd",
    // SALB filler placeholders: "Waterbody" for lake/sea polygons, "Name
    // Unknown" for unidentified slivers, "(Area) under National
    // Administration" mirroring WFP/UNICEF's equivalent bucket, and "Area
    // without administration at (the) 2nd level" where the country has no
    // real subdivision at this tier.
    junkNameField: "adm{level}nm",
    junkNameValues: [
      "Waterbody",
      "Name Unknown",
      "Area under National Administration",
      "Under National Administration",
      "Area without administration at 2nd level",
      "Area without administration at the 2nd level",
      "N/A",
      "N_A",
      "Administrative unit not available",
      // Genuinely blank (empty-string or whitespace-only) names — SALB-only,
      // found via a parent/child equal-count audit (e.g. all 26 Swiss
      // cantons have a single-space adm2nm, since SALB has no real adm2 tier
      // for Switzerland).
      "",
      " ",
    ],
    // Hand-picked exact-match names (see UNICEF's comment above). SALB's
    // Burundi adm1/adm2 both carry "Lake Tanganyika" literally — note this is
    // NOT the same as DRC's real "Tanganyika" province (no "Lake" prefix),
    // which this exact match correctly leaves untouched.
    namedWaterBodies: ["Lake Tanganyika"],
  },
  {
    id: "wb",
    label: "World Bank",
    levels: [1, 2] as AdminLevel[],
    nameField: "NAM_{level}",
    codeField: "ADM{level}CD_c",
    countryCodeField: "ISO_A3",
    // Same filler convention as WFP/UNICEF/FAO (see above). Note this
    // includes Anguilla's entire adm1 dataset (100% "Name Unknown") — an
    // intentional trade-off, since an unnamed polygon isn't usable admin
    // data regardless of how much of a country it covers.
    junkNameField: "NAM_{level}",
    junkNameValues: [
      "Name Unknown",
      "Under National Administration",
      "Administrative unit not available",
    ],
  },
];

export function getLevelsForSource(sourceId: string): AdminLevel[] {
  return ADMIN_SOURCES.find((s) => s.id === sourceId)?.levels ?? [];
}
