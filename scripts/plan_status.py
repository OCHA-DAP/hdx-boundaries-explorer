#!/usr/bin/env python3
"""Fetch OCHA HPC Tools plan data and rank each country's humanitarian plan status.

Ranking mirrors hdx-cod-ab-status's woPlanTypeRank: HNRP > HRP > FA > REG > Other > none.
Requires static/parquet/m49.parquet to already exist (run scripts/m49.py first).
"""

import csv
import json
import subprocess
import tempfile
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

FIRST_YEAR = 2000
LAST_YEAR = date.today().year
M49_PARQUET = Path("static/parquet/m49.parquet")
OUT_PARQUET = Path("static/parquet/plan_status.parquet")


def fetch_plans_for_year(year: int) -> list:
    url = f"https://api.hpc.tools/v2/public/plan?year={year}&limit=500"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("data", [])


def get_plan_type(plan: dict) -> str:
    for cat in plan.get("categories", []):
        if cat.get("group") == "planType":
            return cat.get("code", "")
    return ""


rows = []
for year in range(FIRST_YEAR, LAST_YEAR + 1):
    try:
        plans = fetch_plans_for_year(year)
    except urllib.error.HTTPError:
        continue
    for plan in plans:
        plan_type = get_plan_type(plan)
        if not plan_type:
            continue
        for loc in plan.get("locations", []):
            iso3 = (loc.get("iso3") or "").strip().upper()
            if len(iso3) == 3:
                rows.append((iso3, year, plan_type))

OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(
    suffix=".csv", mode="w", newline="", encoding="utf-8", delete=False
) as f:
    tmp_path = Path(f.name)
    writer = csv.writer(f)
    writer.writerow(["iso3", "year", "type"])
    writer.writerows(rows)

# Rank per iso3 with the best (lowest) rank ever seen across all fetched years,
# tie-broken by the most recent year, then left-join onto the full M49 country
# list so every country gets a row (rank=5, nulls) even with no plan history.
try:
    subprocess.run(
        [
            "duckdb",
            "-c",
            f"""
            COPY (
              WITH raw AS (
                SELECT iso3, year, type,
                  CASE
                    WHEN lower(type) LIKE '%hnrp%' THEN 0
                    WHEN lower(type) LIKE '%hrp%' THEN 1
                    WHEN lower(type) LIKE '%fa%' THEN 2
                    WHEN lower(type) LIKE '%reg%' THEN 3
                    ELSE 4
                  END AS rank
                FROM read_csv('{tmp_path}')
              ),
              best AS (
                SELECT iso3, type AS plan_type, year AS plan_year, rank
                FROM raw
                QUALIFY row_number() OVER (
                  PARTITION BY iso3 ORDER BY rank ASC, year DESC
                ) = 1
              )
              SELECT
                m."ISO-alpha3 Code" AS iso3,
                b.plan_type,
                b.plan_year,
                COALESCE(b.rank, 5) AS rank
              FROM read_parquet('{M49_PARQUET}') m
              LEFT JOIN best b ON b.iso3 = m."ISO-alpha3 Code"
            ) TO '{OUT_PARQUET}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15)
            """,
        ],
        check=True,
    )
finally:
    tmp_path.unlink(missing_ok=True)

print(f"Wrote plan status from {len(rows)} plan-country-year rows → {OUT_PARQUET}")
