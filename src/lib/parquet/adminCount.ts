import { asyncBufferFromUrl, parquetRead } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import type { AdminLevel } from '$lib/map/layers/admin';
import { parquetUrl } from './url';

// Per-level cache: level -> Promise<Map<iso3, count>>
const cache = new Map<number, Promise<Map<string, number>>>();

function loadCounts(level: AdminLevel): Promise<Map<string, number>> {
  return asyncBufferFromUrl({ url: parquetUrl(`ocha_adm${level}`) }).then(
    (asyncBuffer) =>
      new Promise((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: ['iso3'],
          compressors,
          rowFormat: 'object',
          onComplete(rows) {
            const counts = new Map<string, number>();
            for (const row of rows as Array<{ iso3: string }>) {
              counts.set(row.iso3, (counts.get(row.iso3) ?? 0) + 1);
            }
            resolve(counts);
          }
        });
      })
  );
}

export async function getAdminCount(level: AdminLevel, iso3: string): Promise<number> {
  if (!cache.has(level)) cache.set(level, loadCounts(level));
  const counts = await cache.get(level)!;
  return counts.get(iso3) ?? 0;
}
