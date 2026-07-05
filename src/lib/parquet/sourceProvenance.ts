import { asyncBufferFromUrl, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { parquetUrl } from "./url";

export interface SourceProvenance {
  source: string;
  iso3: string;
  provider: string;
  sourceUpdated: string | null;
}

let provenancePromise: Promise<SourceProvenance[]> | null = null;

function loadProvenance(): Promise<SourceProvenance[]> {
  return asyncBufferFromUrl({ url: parquetUrl("source_provenance") }).then(
    (asyncBuffer) =>
      new Promise((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: ["source", "iso3", "provider", "source_updated"],
          compressors,
          rowFormat: "object",
          onComplete(rows) {
            const provenance = (
              rows as Array<{
                source: string;
                iso3: string;
                provider: string;
                source_updated: Date | null;
              }>
            ).map((r) => ({
              source: r.source,
              iso3: r.iso3,
              provider: r.provider,
              sourceUpdated: r.source_updated ? r.source_updated.toISOString().slice(0, 10) : null,
            }));
            resolve(provenance);
          },
        });
      }),
  );
}

export function getAllSourceProvenance(): Promise<SourceProvenance[]> {
  if (!provenancePromise) provenancePromise = loadProvenance();
  return provenancePromise;
}

export async function getProvenanceForCountry(iso3: string): Promise<SourceProvenance[]> {
  const provenance = await getAllSourceProvenance();
  return provenance.filter((p) => p.iso3 === iso3);
}
