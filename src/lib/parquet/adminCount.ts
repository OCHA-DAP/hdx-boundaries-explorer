import { asyncBufferFromUrl, parquetRead } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import type { AdminLevel } from '$lib/map/layers/admin';
import { ADMIN_SOURCES } from '$lib/sources';
import { parquetUrl } from './url';

// Cache keyed by `${source}-${level}` -> Promise<Map<iso3, count>>
const cache = new Map<string, Promise<Map<string, number>>>();

function loadCounts(source: string, level: AdminLevel): Promise<Map<string, number>> {
  const countryCodeField = ADMIN_SOURCES.find((s) => s.id === source)?.countryCodeField ?? 'iso3';
  return asyncBufferFromUrl({ url: parquetUrl(`${source}_adm${level}`) }).then(
    (asyncBuffer) =>
      new Promise((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: [countryCodeField],
          compressors,
          rowFormat: 'object',
          onComplete(rows) {
            const counts = new Map<string, number>();
            for (const row of rows as Array<Record<string, string>>) {
              const key = row[countryCodeField];
              counts.set(key, (counts.get(key) ?? 0) + 1);
            }
            resolve(counts);
          },
        });
      }),
  );
}

export async function getAdminCount(
  source: string,
  level: AdminLevel,
  iso3: string,
): Promise<number> {
  const key = `${source}-${level}`;
  if (!cache.has(key)) cache.set(key, loadCounts(source, level));
  const counts = await cache.get(key)!;
  return counts.get(iso3) ?? 0;
}
