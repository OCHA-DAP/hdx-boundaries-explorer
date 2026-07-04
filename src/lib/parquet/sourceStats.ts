import { asyncBufferFromUrl, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { parquetUrl } from "./url";

export interface SourceStat {
  source: string;
  level: number;
  iso3: string;
  featureCount: number;
  totalVertices: number;
  avgVertices: number;
  edgeVertices: number;
  internalVertices: number;
}

let statsPromise: Promise<SourceStat[]> | null = null;

function loadStats(): Promise<SourceStat[]> {
  return asyncBufferFromUrl({ url: parquetUrl("source_stats") }).then(
    (asyncBuffer) =>
      new Promise((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: [
            "source",
            "level",
            "iso3",
            "feature_count",
            "total_vertices",
            "avg_vertices",
            "edge_vertices",
            "internal_vertices",
          ],
          compressors,
          rowFormat: "object",
          onComplete(rows) {
            const stats = (
              rows as Array<{
                source: string;
                level: number;
                iso3: string;
                feature_count: number;
                total_vertices: number;
                avg_vertices: number;
                edge_vertices: number;
                internal_vertices: number;
              }>
            ).map((r) => ({
              source: r.source,
              level: r.level,
              iso3: r.iso3,
              featureCount: r.feature_count,
              totalVertices: r.total_vertices,
              avgVertices: r.avg_vertices,
              edgeVertices: r.edge_vertices,
              internalVertices: r.internal_vertices,
            }));
            resolve(stats);
          },
        });
      }),
  );
}

export function getAllSourceStats(): Promise<SourceStat[]> {
  if (!statsPromise) statsPromise = loadStats();
  return statsPromise;
}

export async function getStatsForCountry(iso3: string): Promise<SourceStat[]> {
  const stats = await getAllSourceStats();
  return stats.filter((s) => s.iso3 === iso3);
}
