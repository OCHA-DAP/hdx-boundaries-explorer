import type { AdminLevel } from '$lib/map/layers/admin';

export const ADMIN_SOURCES = [
  { id: 'ocha', label: 'OCHA', levels: [1, 2, 3, 4, 5] as AdminLevel[] },
  { id: 'unhcr', label: 'UNHCR', levels: [1, 2] as AdminLevel[] }
];

export function getLevelsForSource(sourceId: string): AdminLevel[] {
  return ADMIN_SOURCES.find((s) => s.id === sourceId)?.levels ?? [];
}
