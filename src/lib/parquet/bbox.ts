import { asyncBufferFromUrl, parquetRead } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { parquetUrl } from './url';

export type Bbox = [number, number, number, number];

// Reads iso3cd + geometry_bbox covering columns for all rows and builds a lookup map.
// 260 rows × 2 tiny columns = a handful of HTTP range requests totaling ~50-100 KB.
async function loadBboxMap(file: string): Promise<Map<string, Bbox>> {
  const url = parquetUrl(file);
  const asyncBuffer = await asyncBufferFromUrl({ url });
  const map = new Map<string, Bbox>();

  await new Promise<void>((resolve) => {
    parquetRead({
      file: asyncBuffer,
      columns: ['iso3cd', 'geometry_bbox'],
      compressors,
      rowFormat: 'object',
      onComplete(rows) {
        for (const row of rows as Array<{
          iso3cd: string;
          geometry_bbox: { xmin: number; ymin: number; xmax: number; ymax: number };
        }>) {
          if (row.iso3cd && row.geometry_bbox) {
            const { xmin, ymin, xmax, ymax } = row.geometry_bbox;
            map.set(row.iso3cd, [xmin, ymin, xmax, ymax]);
          }
        }
        resolve();
      },
    });
  });

  return map;
}

const mapPromises = new Map<string, Promise<Map<string, Bbox>>>();

export async function getBboxForIso3(iso3: string, file = 'salb_adm0'): Promise<Bbox | null> {
  if (!mapPromises.has(file)) {
    mapPromises.set(file, loadBboxMap(file));
  }
  const map = await mapPromises.get(file)!;
  return map.get(iso3) ?? null;
}
