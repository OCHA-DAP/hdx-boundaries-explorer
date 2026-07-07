import { parseCsv } from "./csv";

export interface Decision {
  iso3: string;
  countryName: string;
  selectedSource: string | null;
  // True when the sheet's selected_source cell is the literal text "null" —
  // a deliberate "none of our sources are suitable" call, distinct from a
  // blank cell (no decision made yet).
  noSourceSuitable: boolean;
  accepted: boolean;
  rationale: string;
  lastUpdated: string | null;
}

const SHEET_URL = import.meta.env.VITE_DECISIONS_SHEET_URL as string | undefined;

export function acceptedLabel(accepted: boolean): string {
  return accepted ? "Accepted" : "Pending";
}

function parseAccepted(raw: string): boolean {
  return raw.trim().toLowerCase() === "true";
}

function rowsToDecisions(rows: string[][]): Map<string, Decision> {
  const map = new Map<string, Decision>();
  if (rows.length === 0) return map;

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iso3Col = col("iso3");
  const nameCol = col("country_name");
  const sourceCol = col("selected_source");
  const acceptedCol = col("accepted");
  const rationaleCol = col("rationale");
  const updatedCol = col("last_updated");

  if (iso3Col === -1) return map;

  for (const row of rows.slice(1)) {
    const iso3 = row[iso3Col]?.trim().toUpperCase();
    if (!iso3) continue;

    const rawSource = sourceCol !== -1 ? (row[sourceCol]?.trim() ?? "") : "";
    const noSourceSuitable = rawSource.toLowerCase() === "null";
    const selectedSource = noSourceSuitable ? "" : rawSource;

    map.set(iso3, {
      iso3,
      countryName: nameCol !== -1 ? (row[nameCol]?.trim() ?? "") : "",
      selectedSource: selectedSource || null,
      noSourceSuitable,
      accepted: acceptedCol !== -1 ? parseAccepted(row[acceptedCol] ?? "") : false,
      rationale: rationaleCol !== -1 ? (row[rationaleCol]?.trim() ?? "") : "",
      lastUpdated: updatedCol !== -1 ? row[updatedCol]?.trim() || null : null,
    });
  }

  return map;
}

// Memoized for the page's lifetime, like every other loader in $lib/parquet —
// the sheet is edited rarely enough that a reload is an acceptable way to
// pick up changes. Without this, every country click re-fetched the whole
// CSV from Google Sheets from scratch (CountrySidebar on mount, StatsPanel
// and StatsComparisonTable on every iso3 change) — a real network round trip
// gating the "team's pick" checkmark, visible as lag even though every other
// per-country lookup here is a memoized, already-loaded parquet file.
let decisionsPromise: Promise<Map<string, Decision>> | null = null;

export function getDecisions(): Promise<Map<string, Decision>> {
  if (!SHEET_URL) return Promise.resolve(new Map());
  if (!decisionsPromise) decisionsPromise = fetchDecisions();
  return decisionsPromise;
}

async function fetchDecisions(): Promise<Map<string, Decision>> {
  try {
    const res = await fetch(SHEET_URL as string, { cache: "no-store" });
    if (!res.ok) return new Map();
    const text = await res.text();
    return rowsToDecisions(parseCsv(text));
  } catch {
    // Network error (offline, CORS misconfiguration, Google outage, etc.) —
    // degrade to "no decisions" rather than failing the whole page.
    return new Map();
  }
}

export async function getDecisionForIso3(iso3: string): Promise<Decision | null> {
  const decisions = await getDecisions();
  return decisions.get(iso3) ?? null;
}
