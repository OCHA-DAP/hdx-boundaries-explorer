import { asyncBufferFromUrl, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { parquetUrl } from "./url";

export interface SourceMatch {
  source: string;
  level: number;
  iso3: string;
  preferredSource: string;
  matchedCount: number;
}

let matchPromise: Promise<SourceMatch[]> | null = null;

function loadMatch(): Promise<SourceMatch[]> {
  return asyncBufferFromUrl({ url: parquetUrl("source_match") }).then(
    (asyncBuffer) =>
      new Promise((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: ["source", "level", "iso3", "preferred_source", "matched_count"],
          compressors,
          rowFormat: "object",
          onComplete(rows) {
            const matches = (
              rows as Array<{
                source: string;
                level: bigint | number;
                iso3: string;
                preferred_source: string;
                matched_count: bigint | number;
              }>
            ).map((r) => ({
              source: r.source,
              // BIGINT columns (a CSV round-trip in match.sh) decode as JS bigint; coerce to number.
              level: Number(r.level),
              iso3: r.iso3,
              preferredSource: r.preferred_source,
              matchedCount: Number(r.matched_count),
            }));
            resolve(matches);
          },
        });
      }),
  );
}

export function getAllSourceMatch(): Promise<SourceMatch[]> {
  if (!matchPromise) matchPromise = loadMatch();
  return matchPromise;
}

export async function getMatchForCountry(iso3: string): Promise<SourceMatch[]> {
  const matches = await getAllSourceMatch();
  return matches.filter((m) => m.iso3 === iso3);
}
