import { asyncBufferFromUrl, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { parquetUrl } from "./url";

export type OfficeType = "CO" | "RO" | "HAT";

let officeTypePromise: Promise<Map<string, OfficeType>> | null = null;

export function getAllOfficeTypes(): Promise<Map<string, OfficeType>> {
  if (!officeTypePromise) {
    officeTypePromise = (async () => {
      const asyncBuffer = await asyncBufferFromUrl({ url: parquetUrl("office_type") });
      return new Promise<Map<string, OfficeType>>((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: ["iso3", "office_type"],
          compressors,
          rowFormat: "object",
          onComplete(rows) {
            const map = new Map<string, OfficeType>();
            for (const row of rows as Array<{ iso3: string; office_type: OfficeType }>) {
              map.set(row.iso3, row.office_type);
            }
            resolve(map);
          },
        });
      });
    })();
  }
  return officeTypePromise;
}
