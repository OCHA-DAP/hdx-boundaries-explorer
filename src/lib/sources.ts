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
  },
  {
    id: "unicef",
    label: "UNICEF",
    levels: [1, 2, 3, 4] as AdminLevel[],
    nameField: "name",
    codeField: "Source_ID",
    countryCodeField: "adm0_ucode",
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
  },
  {
    id: "wb",
    label: "World Bank",
    levels: [1, 2] as AdminLevel[],
    nameField: "NAM_{level}",
    codeField: "ADM{level}CD_c",
    countryCodeField: "ISO_A3",
  },
  {
    id: "salb",
    label: "SALB",
    levels: [1, 2] as AdminLevel[],
    nameField: "adm{level}nm",
    codeField: "adm{level}cd",
    countryCodeField: "iso3cd",
  },
];

export function getLevelsForSource(sourceId: string): AdminLevel[] {
  return ADMIN_SOURCES.find((s) => s.id === sourceId)?.levels ?? [];
}
