import type { AdminLevel } from '$lib/map/layers/admin';

export const ADMIN_SOURCES = [
  {
    id: 'ocha',
    label: 'OCHA',
    levels: [1, 2, 3, 4, 5] as AdminLevel[],
    nameField: 'adm{level}_name',
    codeField: 'adm{level}_pcode',
  },
  {
    id: 'wfp',
    label: 'WFP',
    levels: [1, 2, 3, 4] as AdminLevel[],
    nameField: 'adm{level}_name',
    codeField: 'source_id',
  },
  {
    id: 'unhcr',
    label: 'UNHCR',
    levels: [1, 2] as AdminLevel[],
    nameField: 'gis_name',
    codeField: 'adm{level}_source_code',
  },
];

export function getLevelsForSource(sourceId: string): AdminLevel[] {
  return ADMIN_SOURCES.find((s) => s.id === sourceId)?.levels ?? [];
}
