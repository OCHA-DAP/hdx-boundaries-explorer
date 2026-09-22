const PMTILES_BASE =
  (import.meta.env.VITE_PMTILES_BASE as string | undefined) ??
  "https://hdx-boundaries-explorer.fieldmaps.io/pmtiles";

const PARQUET_BASE = PMTILES_BASE.replace(/\/pmtiles$/, "/parquet");

export function parquetUrl(file: string): string {
  return `${resolvedBase()}/${file}.parquet`;
}

export function csvUrl(file: string): string {
  return `${resolvedBase()}/${file}.csv`;
}

function resolvedBase(): string {
  return PARQUET_BASE.startsWith("/")
    ? `${globalThis.location?.origin ?? ""}${PARQUET_BASE}`
    : PARQUET_BASE;
}
