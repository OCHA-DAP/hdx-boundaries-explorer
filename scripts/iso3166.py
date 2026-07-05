#!/usr/bin/env python3
"""Fetch ISO 3166-2 subdivision counts from Debian's iso-codes project.

ISO's own Online Browsing Platform (iso.org/obp) has no public API and blocks
scraping, but Debian's iso-codes package — the same source pycountry uses —
publishes a JSON mirror of the standard's subdivision codes. Counting entries
per country reproduces the "how many subdivisions does ISO list" figure a
person would otherwise read off the OBP UI by hand.

Requires static/parquet/m49.parquet to already exist (run scripts/m49.py first).
"""

import csv
import json
import subprocess
import tempfile
import urllib.request
from collections import Counter
from pathlib import Path

URL = "https://salsa.debian.org/iso-codes-team/iso-codes/-/raw/main/data/iso_3166-2.json"
M49_PARQUET = Path("static/parquet/m49.parquet")
OUT_PARQUET = Path("static/parquet/iso3166.parquet")

# Salsa's Anubis bot-check challenges a spoofed browser User-Agent but passes
# a plain script-like one, so this deliberately omits the header the other
# scripts in this repo set.
with urllib.request.urlopen(URL, timeout=30) as r:
    subdivisions = json.load(r)["3166-2"]

counts = Counter(entry["code"][:2] for entry in subdivisions)

OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(
    suffix=".csv", mode="w", newline="", encoding="utf-8", delete=False
) as f:
    tmp_path = Path(f.name)
    writer = csv.writer(f)
    writer.writerow(["iso2", "subdivision_count"])
    writer.writerows(sorted(counts.items()))

try:
    subprocess.run(
        [
            "duckdb",
            "-c",
            f"""
            COPY (
              SELECT
                m."ISO-alpha3 Code" AS iso3,
                m."ISO-alpha2 Code" AS iso2,
                c.subdivision_count
              FROM read_parquet('{M49_PARQUET}') m
              LEFT JOIN read_csv('{tmp_path}') c ON c.iso2 = m."ISO-alpha2 Code"
            ) TO '{OUT_PARQUET}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15)
            """,
        ],
        check=True,
    )
finally:
    tmp_path.unlink(missing_ok=True)

print(f"Wrote ISO 3166-2 subdivision counts for {len(counts)} countries → {OUT_PARQUET}")
