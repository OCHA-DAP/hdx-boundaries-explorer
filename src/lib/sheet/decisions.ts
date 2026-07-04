import { parseCsv } from "./csv";

export type DecisionStatus = "no_opinion" | "undecided" | "unanimous";

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  no_opinion: "No opinion",
  undecided: "Undecided (option in mind)",
  unanimous: "Unanimous decision",
};

const STATUS_BY_LABEL: Record<string, DecisionStatus> = {
  "no opinion": "no_opinion",
  "undecided (option in mind)": "undecided",
  "unanimous decision": "unanimous",
};

export interface Decision {
  iso3: string;
  countryName: string;
  selectedSource: string | null;
  status: DecisionStatus;
  rationale: string;
  lastUpdated: string | null;
}

const SHEET_URL = import.meta.env.VITE_DECISIONS_SHEET_URL as string | undefined;

function parseStatus(raw: string): DecisionStatus {
  return STATUS_BY_LABEL[raw.trim().toLowerCase()] ?? "no_opinion";
}

function rowsToDecisions(rows: string[][]): Map<string, Decision> {
  const map = new Map<string, Decision>();
  if (rows.length === 0) return map;

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iso3Col = col("iso3");
  const nameCol = col("country_name");
  const sourceCol = col("selected_source");
  const statusCol = col("status");
  const rationaleCol = col("rationale");
  const updatedCol = col("last_updated");

  if (iso3Col === -1) return map;

  for (const row of rows.slice(1)) {
    const iso3 = row[iso3Col]?.trim().toUpperCase();
    if (!iso3) continue;

    const selectedSource = sourceCol !== -1 ? (row[sourceCol]?.trim() ?? "") : "";

    map.set(iso3, {
      iso3,
      countryName: nameCol !== -1 ? (row[nameCol]?.trim() ?? "") : "",
      selectedSource: selectedSource || null,
      status: statusCol !== -1 ? parseStatus(row[statusCol] ?? "") : "no_opinion",
      rationale: rationaleCol !== -1 ? (row[rationaleCol]?.trim() ?? "") : "",
      lastUpdated: updatedCol !== -1 ? row[updatedCol]?.trim() || null : null,
    });
  }

  return map;
}

// Not memoized: the sheet is edited live by contributors outside of a deploy,
// so each caller fetches fresh rather than sharing one eternal cached promise.
export async function getDecisions(): Promise<Map<string, Decision>> {
  if (!SHEET_URL) return new Map();
  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
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
