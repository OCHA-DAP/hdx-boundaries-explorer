import { asyncBufferFromUrl, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { parquetUrl } from "./url";

export type Bbox = [number, number, number, number];

// Reads the precomputed per-country fit bbox and builds a lookup map. Unlike GDAL's
// raw geometry_bbox covering column, these xmin/xmax are antimeridian-aware (see
// scripts/bbox.sh) — xmax may exceed 180 for a country with territory near the
// dateline, which is intentional and must be passed straight through to
// map.fitBounds rather than "normalized".
// 260 rows × tiny columns = a handful of HTTP range requests totaling ~50-100 KB.
async function loadBboxMap(file: string): Promise<Map<string, Bbox>> {
  const url = parquetUrl(file);
  const asyncBuffer = await asyncBufferFromUrl({ url });
  const map = new Map<string, Bbox>();

  await new Promise<void>((resolve) => {
    parquetRead({
      file: asyncBuffer,
      columns: ["iso3", "xmin", "ymin", "xmax", "ymax"],
      compressors,
      rowFormat: "object",
      onComplete(rows) {
        for (const row of rows as Array<{
          iso3: string;
          xmin: number;
          ymin: number;
          xmax: number;
          ymax: number;
        }>) {
          if (row.iso3) {
            map.set(row.iso3, [row.xmin, row.ymin, row.xmax, row.ymax]);
          }
        }
        resolve();
      },
    });
  });

  return map;
}

const mapPromises = new Map<string, Promise<Map<string, Bbox>>>();

export async function getBboxForIso3(iso3: string, file = "country_bbox"): Promise<Bbox | null> {
  if (!mapPromises.has(file)) {
    mapPromises.set(file, loadBboxMap(file));
  }
  const map = await mapPromises.get(file)!;
  return map.get(iso3) ?? null;
}
