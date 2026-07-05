# /// script
# requires-python = ">=3.11"
# dependencies = ["tenacity"]
# ///
"""Fetch per-country, per-level admin unit counts from Mapbox's Boundaries Explorer demo.

Mapbox Boundaries itself is a licensed dataset with no public bulk API, but the
public demo at demos.mapbox.com/boundaries-explorer loads a small per-country,
per-level lookup JSON (name/code/wikidata_id per unit) to populate its own UI.
Counting entries in that lookup reproduces the "how many admin units does
Mapbox Boundaries have" figure a person would otherwise read off the demo by
hand, without needing a Mapbox Boundaries API token.

Requires static/parquet/m49.parquet to already exist (run scripts/m49.py first).
"""

import csv
import json
import subprocess
import tempfile
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

LOOKUP_URL = "https://demos.mapbox.com/boundaries-explorer/lib/lookups/{iso2}/adm{level}.json"
LEVELS = [1, 2, 3, 4]
M49_PARQUET = Path("static/parquet/m49.parquet")
OUT_PARQUET = Path("static/parquet/mapbox_boundaries.parquet")
MAX_WORKERS = 8


def _is_retryable(exc: BaseException) -> bool:
    # A 404 means this level doesn't exist for the country (a real, expected
    # answer) — only transient failures should be retried.
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code != 404
    return isinstance(exc, urllib.error.URLError)


@retry(
    retry=retry_if_exception(_is_retryable),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=1, max=10),
)
def fetch_count(iso2: str, level: int) -> int | None:
    url = LOOKUP_URL.format(iso2=iso2, level=level)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    return len(data.get("all", {}))


def get_iso2_codes() -> list[tuple[str, str]]:
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
        tmp_path = Path(f.name)
    try:
        subprocess.run(
            [
                "duckdb",
                "-c",
                f"""
                COPY (
                  SELECT "ISO-alpha3 Code" AS iso3, "ISO-alpha2 Code" AS iso2
                  FROM read_parquet('{M49_PARQUET}')
                  WHERE "ISO-alpha2 Code" IS NOT NULL
                ) TO '{tmp_path}' (FORMAT CSV, HEADER TRUE)
                """,
            ],
            check=True,
        )
        with open(tmp_path, newline="", encoding="utf-8") as f:
            return [(row["iso3"], row["iso2"]) for row in csv.DictReader(f)]
    finally:
        tmp_path.unlink(missing_ok=True)


countries = get_iso2_codes()
rows: list[tuple[str, str, int, int]] = []

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
    futures = {
        pool.submit(fetch_count, iso2, level): (iso3, iso2, level)
        for iso3, iso2 in countries
        for level in LEVELS
    }
    for future, (iso3, iso2, level) in futures.items():
        count = future.result()
        if count is not None:
            rows.append((iso3, iso2, level, count))

OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(
    suffix=".csv", mode="w", newline="", encoding="utf-8", delete=False
) as f:
    tmp_path = Path(f.name)
    writer = csv.writer(f)
    writer.writerow(["iso3", "iso2", "level", "feature_count"])
    writer.writerows(sorted(rows))

try:
    subprocess.run(
        [
            "duckdb",
            "-c",
            f"""
            COPY (
              SELECT * FROM read_csv('{tmp_path}')
            ) TO '{OUT_PARQUET}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15)
            """,
        ],
        check=True,
    )
finally:
    tmp_path.unlink(missing_ok=True)

print(f"Wrote Mapbox Boundaries counts for {len(rows)} country/level pairs → {OUT_PARQUET}")
