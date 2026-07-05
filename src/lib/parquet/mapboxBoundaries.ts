import { asyncBufferFromUrl, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { parquetUrl } from "./url";

export interface MapboxBoundaries {
  iso3: string;
  iso2: string;
  counts: Record<number, number>;
}

let mapboxBoundariesPromise: Promise<Map<string, MapboxBoundaries>> | null = null;

export function getAllMapboxBoundaries(): Promise<Map<string, MapboxBoundaries>> {
  if (!mapboxBoundariesPromise) {
    mapboxBoundariesPromise = (async () => {
      const asyncBuffer = await asyncBufferFromUrl({ url: parquetUrl("mapbox_boundaries") });
      return new Promise<Map<string, MapboxBoundaries>>((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: ["iso3", "iso2", "level", "feature_count"],
          compressors,
          rowFormat: "object",
          onComplete(rows) {
            const map = new Map<string, MapboxBoundaries>();
            for (const row of rows as Array<{
              iso3: string;
              iso2: string;
              level: number;
              feature_count: number;
            }>) {
              let entry = map.get(row.iso3);
              if (!entry) {
                entry = { iso3: row.iso3, iso2: row.iso2, counts: {} };
                map.set(row.iso3, entry);
              }
              entry.counts[row.level] = row.feature_count;
            }
            resolve(map);
          },
        });
      });
    })();
  }
  return mapboxBoundariesPromise;
}

export async function getMapboxBoundariesForCountry(
  iso3: string,
): Promise<MapboxBoundaries | null> {
  const map = await getAllMapboxBoundaries();
  return map.get(iso3) ?? null;
}
