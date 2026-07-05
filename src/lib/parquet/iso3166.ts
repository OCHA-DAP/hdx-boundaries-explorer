import { asyncBufferFromUrl, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { parquetUrl } from "./url";

export interface Iso3166 {
  iso3: string;
  iso2: string;
  subdivisionCount: number | null;
}

let iso3166Promise: Promise<Map<string, Iso3166>> | null = null;

export function getAllIso3166(): Promise<Map<string, Iso3166>> {
  if (!iso3166Promise) {
    iso3166Promise = (async () => {
      const asyncBuffer = await asyncBufferFromUrl({ url: parquetUrl("iso3166") });
      return new Promise<Map<string, Iso3166>>((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: ["iso3", "iso2", "subdivision_count"],
          compressors,
          rowFormat: "object",
          onComplete(rows) {
            const map = new Map<string, Iso3166>();
            for (const row of rows as Array<{
              iso3: string;
              iso2: string;
              subdivision_count: number | null;
            }>) {
              map.set(row.iso3, {
                iso3: row.iso3,
                iso2: row.iso2,
                subdivisionCount: row.subdivision_count,
              });
            }
            resolve(map);
          },
        });
      });
    })();
  }
  return iso3166Promise;
}

export async function getIso3166ForCountry(iso3: string): Promise<Iso3166 | null> {
  const map = await getAllIso3166();
  return map.get(iso3) ?? null;
}
