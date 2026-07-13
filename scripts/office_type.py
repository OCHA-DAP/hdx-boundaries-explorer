# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///
"""Fetch OCHA country offices (CO), humanitarian advisory teams (HAT), and
regional offices (RO) from OCHA's PowerBI HOO contact-list dashboard.

Ported from hdx-cod-ab-status's scripts/offices.py — same PowerBI query
mechanics and name-resolution rules, adapted to write parquet (via DuckDB)
instead of CSV.

Requires static/parquet/m49.parquet to already exist (run scripts/m49.py first).

Dashboard: https://app.powerbi.com/view?r=eyJrIjoiZTNmYjk4ZDUtZDFlYi00MzllLTk5YTAtY2NiNTQ5MmRmZWY0IiwidCI6IjBmOWUzNWRiLTU0NGYtNGY2MC1iZGNjLTVlYTQxNmU2ZGM3MCIsImMiOjh9
"""

import csv
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

import requests

M49_PARQUET = Path("static/parquet/m49.parquet")
OUT_PARQUET = Path("static/parquet/office_type.parquet")

# ---------------------------------------------------------------------------
# PowerBI embed parameters (decoded from the dashboard embed URL).
# The APIM host is derived from the cluster URI by stripping "-redirect"
# and appending "-api" to the first hostname segment (PowerBI getAPIMUrl logic).
# Cluster: https://wabi-north-europe-j-primary-redirect.analysis.windows.net
# APIM:    https://wabi-north-europe-j-primary-api.analysis.windows.net
# ---------------------------------------------------------------------------
RESOURCE_KEY = "e3fb98d5-d1eb-439e-99a0-ccb5492dfef4"
APIM = "https://wabi-north-europe-j-primary-api.analysis.windows.net"
MODEL_ID = 156451  # from conceptualschema response

# ---------------------------------------------------------------------------
# Country offices confirmed in the Jan 2026 OCHA org chart PDF, for
# verification only (mirrors the upstream script's sanity check).
# ---------------------------------------------------------------------------
PDF_CO_ISO3: set[str] = {
    "AFG", "BFA", "CMR", "CAF", "TCD", "COL", "COD", "ERI", "ETH", "HTI",
    "LBN", "MLI", "MOZ", "MMR", "NER", "NGA", "PSE", "PAK", "SOM", "SSD",
    "SDN", "SYR", "TUR", "UKR", "VEN", "YEM",
}

# ---------------------------------------------------------------------------
# Name → ISO3 overrides for entries where the dashboard label differs from
# M49, or where the ISO column in the dashboard is null/missing.
# ---------------------------------------------------------------------------
NAME_OVERRIDES: dict[str, str] = {
    # CO table
    "opt": "PSE",  # "Occupied Palestinian Territory"
    "occupied palestinian territory": "PSE",
    "state of palestine": "PSE",
    "turkiye": "TUR",
    "türkiye": "TUR",
    "turkey": "TUR",
    "syrian arab republic": "SYR",
    "syria": "SYR",
    "venezuela (bolivarian republic of)": "VEN",
    "dr congo": "COD",
    "dr of the congo": "COD",
    "democratic republic of the congo": "COD",
    # HAT table
    "guatemala": "GTM",
    "iran": "IRN",
    "dprk": "PRK",  # M49: "Democratic People's Republic of Korea"
}

# ---------------------------------------------------------------------------
# Entries to skip entirely (not sovereign countries).
# ---------------------------------------------------------------------------
SKIP_NAMES: set[str] = {"office for the pacific (suva)", "asean", "aulo"}


def build_m49_lookup() -> dict[str, str]:
    result = subprocess.run(
        [
            "duckdb",
            "-csv",
            "-c",
            "SELECT lower(\"Country or Area\"), \"ISO-alpha3 Code\""
            f" FROM read_parquet('{M49_PARQUET}')",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    lookup: dict[str, str] = {}
    reader = csv.reader(result.stdout.splitlines())
    next(reader)  # header
    for name, iso3 in reader:
        if name and iso3:
            lookup[name] = iso3
    return lookup


# ---------------------------------------------------------------------------
# PowerBI DSR decoder.
#
# Each row in DM0 can have:
#   S   — schema definition (skip as data row)
#   C   — array of new values (indices into ValueDicts)
#   R   — bitmask: bit i set = repeat column i from previous row
#   Ø   — bitmask: bit i set = column i is null (no C slot consumed)
#
# For each column i:
#   if R & (1<<i) → use prev[i]
#   else if Ø & (1<<i) → null
#   else → C[ci++]
# ---------------------------------------------------------------------------
def decode_dsr(dm_rows: list, dicts: dict, num_cols: int) -> list[list]:
    prev = [None] * num_cols
    results = []

    for row in dm_rows:
        # "S" marks a schema definition; the same row may also carry the first
        # data values in "C", so skip only when C is absent or empty.
        if "S" in row and not row.get("C"):
            continue

        R = row.get("R", 0)
        O = row.get("Ø", 0)
        c = row.get("C", [])

        vals = []
        ci = 0
        for i in range(num_cols):
            if R & (1 << i):
                vals.append(prev[i])
            elif O & (1 << i):
                vals.append(None)
            else:
                vals.append(c[ci] if ci < len(c) else None)
                ci += 1

        prev = list(vals)

        resolved = []
        for i, v in enumerate(vals):
            d = dicts.get(f"D{i}")
            if d is not None and isinstance(v, int):
                resolved.append(d[v] if v < len(d) else None)
            else:
                resolved.append(v)

        results.append(resolved)

    return results


def resolve_iso3(name: str, m49: dict[str, str]) -> str | None:
    lower = name.lower().strip()
    if lower in NAME_OVERRIDES:
        return NAME_OVERRIDES[lower]
    if lower in m49:
        return m49[lower]
    # Partial match: every word in the display name appears in an M49 name
    words = lower.split()
    for m49_name, iso3 in m49.items():
        if all(w in m49_name for w in words):
            return iso3
    return None


def query_table(table: str, columns: list[str]) -> list[list]:
    url = f"{APIM}/public/reports/querydata?preferReadOnlySession=true"
    headers = {
        "X-PowerBI-ResourceKey": RESOURCE_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    select = [
        {
            "Column": {
                "Expression": {"SourceRef": {"Source": "t"}},
                "Property": col,
            },
            "Name": col,
        }
        for col in columns
    ]

    body = {
        "queries": [
            {
                "Query": {
                    "Commands": [
                        {
                            "SemanticQueryDataShapeCommand": {
                                "Query": {
                                    "Version": 2,
                                    "From": [{"Name": "t", "Entity": table, "Type": 0}],
                                    "Select": select,
                                },
                                "Binding": {
                                    "Primary": {
                                        "Groupings": [{"Projections": list(range(len(columns)))}]
                                    },
                                    "DataReduction": {
                                        "DataVolume": 4,
                                        "Primary": {"Window": {"Count": 500}},
                                    },
                                    "Version": 1,
                                },
                            }
                        }
                    ]
                }
            }
        ],
        "cancelQueries": [],
        "modelId": MODEL_ID,
    }

    res = requests.post(url, json=body, headers=headers, timeout=20)
    res.raise_for_status()

    data = res.json()
    ds = (
        data.get("results", [{}])[0]
        .get("result", {})
        .get("data", {})
        .get("dsr", {})
        .get("DS", [{}])[0]
    )
    if not ds:
        raise RuntimeError(f'Unexpected querydata response for "{table}"')

    dm_rows = ds.get("PH", [{}])[0].get("DM0", [])
    dicts = ds.get("ValueDicts", {})
    return decode_dsr(dm_rows, dicts, len(columns))


def verify_against_pdf(co_iso3: set[str]) -> None:
    pdf_only = sorted(iso3 for iso3 in PDF_CO_ISO3 if iso3 not in co_iso3)
    pbi_only = sorted(iso3 for iso3 in co_iso3 if iso3 not in PDF_CO_ISO3)

    print("\n=== Verification vs Jan 2026 PDF org chart ===")
    if pdf_only:
        print(
            f"  PDF only ({len(pdf_only)}): {' '.join(pdf_only)}  <- missing from PowerBI",
            file=sys.stderr,
        )
    if pbi_only:
        print(f"  PBI only ({len(pbi_only)}): {' '.join(pbi_only)}  <- not in PDF (new offices?)")
    if not pdf_only and not pbi_only:
        print("  CO lists match exactly.")


m49 = build_m49_lookup()

result_map: dict[str, str] = {}  # iso3 -> type
unmatched: list[dict] = []

# ── 1. Country Offices ────────────────────────────────────────────────────
co_rows = query_table("CO HOO CONTACT LIST", ["COUNTRY", "OFFICE TYPE"])

for row in co_rows:
    country = row[0]
    if not country:
        continue
    if country.lower().strip() in SKIP_NAMES:
        continue

    iso3 = resolve_iso3(country, m49)
    if not iso3:
        unmatched.append({"name": country, "type": "CO"})
        continue
    result_map[iso3] = "CO"

# ── 2. Humanitarian Advisory Teams / Regional Offices ────────────────────
hat_rows = query_table("RO_HAT HOO CONTACT LIST", ["COUNTRY", "OFFICE TYPE"])

for row in hat_rows:
    country, office_type = row[0], row[1]
    if not country or not office_type:
        continue
    if country.lower().strip() in SKIP_NAMES:
        continue

    ot_lower = office_type.lower()
    if "humanitarian" in ot_lower:
        entry_type = "HAT"
    elif "regional" in ot_lower:
        entry_type = "RO"
    else:
        continue  # skip Liaison Offices and other types

    iso3 = resolve_iso3(country, m49)
    if not iso3:
        unmatched.append({"name": country, "type": entry_type})
        continue
    # Priority: CO > HAT > RO — don't overwrite a higher-priority entry
    existing = result_map.get(iso3)
    if existing == "CO" or (existing == "HAT" and entry_type == "RO"):
        continue
    result_map[iso3] = entry_type

# ── 3. Write parquet ───────────────────────────────────────────────────────
sorted_entries = sorted(result_map.items())
OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(
    suffix=".csv", mode="w", newline="", encoding="utf-8", delete=False
) as f:
    tmp_path = Path(f.name)
    writer = csv.writer(f)
    writer.writerow(["iso3", "office_type"])
    writer.writerows(sorted_entries)
try:
    subprocess.run(
        [
            "duckdb",
            "-c",
            f"COPY (SELECT * FROM read_csv('{tmp_path}')) TO '{OUT_PARQUET}'"
            " (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15)",
        ],
        check=True,
    )
finally:
    tmp_path.unlink(missing_ok=True)

type_counts = Counter(t for _, t in sorted_entries)
print(f"\nWrote {len(sorted_entries)} rows -> {OUT_PARQUET}")
print(f"  CO:  {type_counts['CO']}")
print(f"  HAT: {type_counts['HAT']}")
print(f"  RO:  {type_counts['RO']}")

if unmatched:
    names = "\n".join(f'  "{u["name"]}" [{u["type"]}]' for u in unmatched)
    print(
        f"\nWarning: {len(unmatched)} name(s) could not be resolved to ISO3"
        f" (add to NAME_OVERRIDES):\n{names}",
        file=sys.stderr,
    )

# ── 4. Verify COs vs PDF ───────────────────────────────────────────────────
co_iso3 = {iso3 for iso3, t in sorted_entries if t == "CO"}
verify_against_pdf(co_iso3)
