import { asyncBufferFromUrl, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { parquetUrl } from "./url";

export interface PlanStatus {
  iso3: string;
  planType: string | null;
  planYear: number | null;
  rank: number;
}

let planStatusPromise: Promise<Map<string, PlanStatus>> | null = null;

export function getAllPlanStatus(): Promise<Map<string, PlanStatus>> {
  if (!planStatusPromise) {
    planStatusPromise = (async () => {
      const asyncBuffer = await asyncBufferFromUrl({ url: parquetUrl("plan_status") });
      return new Promise<Map<string, PlanStatus>>((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: ["iso3", "plan_type", "plan_year", "rank"],
          compressors,
          rowFormat: "object",
          onComplete(rows) {
            const map = new Map<string, PlanStatus>();
            for (const row of rows as Array<{
              iso3: string;
              plan_type: string | null;
              plan_year: number | null;
              rank: number;
            }>) {
              map.set(row.iso3, {
                iso3: row.iso3,
                planType: row.plan_type,
                planYear: row.plan_year,
                rank: row.rank,
              });
            }
            resolve(map);
          },
        });
      });
    })();
  }
  return planStatusPromise;
}

export async function getPlanStatus(iso3: string): Promise<PlanStatus | null> {
  const map = await getAllPlanStatus();
  return map.get(iso3) ?? null;
}
