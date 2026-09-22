# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb"]
# ///
"""Per-country polygon match rate (IoU vs. the decisions sheet's preferred source).
Requires the source boundary parquet files to exist (run download:<source> first)."""

import argparse
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import duckdb

# Keep in sync with scripts/stats.sh and src/lib/sources.ts.


@dataclass(frozen=True)
class Source:
    name: str
    iso3_field: str
    levels: list[int]
    junk_field: str | None = None  # may contain "{level}"
    junk_values: list[str] = field(default_factory=list)


SOURCES = [
    Source("ocha", "iso3", [1, 2, 3, 4]),
    Source(
        "wfp",
        "iso3",
        [1, 2, 3, 4],
        "adm{level}_name",
        ["Under National Administration", "N/A", "Undefined"],
    ),
    Source(
        "unicef",
        "adm0_ucode",
        [1, 2, 3, 4],
        "name",
        ["Under National Administration", "Lake Tanganyika", "N/A", "Undefined"],
    ),
    Source("unhcr", "iso3", [1, 2]),
    Source(
        "salb",
        "iso3cd",
        [1, 2],
        "adm{level}nm",
        [
            "Waterbody",
            "Name Unknown",
            "Area under National Administration",
            "Under National Administration",
            "Area without administration at 2nd level",
            "Area without administration at the 2nd level",
            "Lake Tanganyika",
            "N/A",
            "N_A",
            "",
            "Administrative unit not available",
        ],
    ),
    Source(
        "fao",
        "ISO3_CODE",
        [1, 2],
        "GAUL{level}_NAME",
        ["Waterbody", "Undefined", "Administrative Unit Not Available"],
    ),
    Source(
        "wb",
        "ISO_A3",
        [1, 2],
        "NAM_{level}",
        ["Name Unknown", "Under National Administration", "Administrative unit not available"],
    ),
]

PARQUET_DIR = Path("static/parquet")

MATCH_QUERY = """
    WITH valid_units AS (
        SELECT unit_id, source, level, ST_MakeValid(geometry) AS geometry
        FROM units WHERE iso3 = ?
    ),
    candidate_sources AS (
        SELECT DISTINCT s.source, s.level
        FROM valid_units s
        WHERE s.source != ?
          AND EXISTS (
              SELECT 1 FROM valid_units p WHERE p.source = ? AND p.level = s.level
          )
    ),
    pairs AS (
        SELECT s.unit_id, s.source, s.level,
            MAX(
                ST_Area_Spheroid(ST_Intersection(s.geometry, p.geometry))
                / ST_Area_Spheroid(ST_Union(s.geometry, p.geometry))
            ) AS best_iou
        FROM valid_units s
        JOIN valid_units p ON p.level = s.level AND p.source = ?
        WHERE s.source != ? AND ST_Intersects(s.geometry, p.geometry)
        GROUP BY s.unit_id, s.source, s.level
    )
    SELECT cs.source, cs.level, ? AS iso3, ? AS preferred_source,
        COALESCE(COUNT(*) FILTER (WHERE pr.best_iou >= ?), 0)::BIGINT AS matched_count
    FROM candidate_sources cs
    LEFT JOIN pairs pr ON pr.source = cs.source AND pr.level = cs.level
    GROUP BY cs.source, cs.level
"""


def read_sheet_url() -> str | None:
    env_path = Path(".env")
    if not env_path.exists():
        return None
    for line in env_path.read_text().splitlines():
        if line.startswith("VITE_DECISIONS_SHEET_URL="):
            return line.split("=", 1)[1].strip()
    return None


def fetch_decisions(sheet_url: str) -> list[tuple[str, str]]:
    con = duckdb.connect()
    con.execute("LOAD httpfs")
    rows = con.execute(
        f"""
        SELECT upper(trim(iso3)) AS iso3, lower(trim(selected_source)) AS preferred_source
        FROM read_csv('{sheet_url}', header=true)
        WHERE selected_source IS NOT NULL
          AND lower(trim(selected_source)) NOT IN ('', 'null')
        """
    ).fetchall()
    con.close()
    return [(iso3, preferred_source) for iso3, preferred_source in rows]


def build_units_sql(level: int) -> str | None:
    parts = []
    for src in SOURCES:
        if level not in src.levels:
            continue
        file = PARQUET_DIR / f"{src.name}_adm{level}.parquet"
        if not file.exists():
            continue
        where_clause = ""
        if src.junk_field:
            resolved_field = src.junk_field.replace("{level}", str(level))
            quoted = ", ".join(f"'{v}'" for v in src.junk_values)
            where_clause = f"WHERE {resolved_field} NOT IN ({quoted})"
        parts.append(
            f"SELECT '{src.name}' AS source, {level} AS level, "
            f"substr({src.iso3_field}, 1, 3) AS iso3, geometry "
            f"FROM read_parquet('{file}') {where_clause}"
        )
    return " UNION ALL ".join(parts) if parts else None


def run_level(
    level: int, threshold: float, decisions: list[tuple[str, str]]
) -> list[tuple[str, int, str, str, int]]:
    units_sql = build_units_sql(level)
    if units_sql is None:
        print(f"[level {level}] no source parquet files found, skipping", file=sys.stderr)
        return []

    con = duckdb.connect()
    con.execute("LOAD spatial")
    con.execute("SET geometry_always_xy = true")
    con.execute(
        f"""
        CREATE TABLE units AS
            SELECT ROW_NUMBER() OVER () AS unit_id, source, level, iso3, geometry
            FROM ( {units_sql} )
        """
    )
    con.execute("CREATE INDEX idx_units_iso3 ON units(iso3)")

    results: list[tuple[str, int, str, str, int]] = []
    total = len(decisions)
    for i, (iso3, preferred_source) in enumerate(decisions, start=1):
        print(f"[level {level}] [{i}/{total}] {iso3} (preferred: {preferred_source})", file=sys.stderr)
        try:
            rows = con.execute(
                MATCH_QUERY,
                [
                    iso3,
                    preferred_source,
                    preferred_source,
                    preferred_source,
                    preferred_source,
                    iso3,
                    preferred_source,
                    threshold,
                ],
            ).fetchall()
        except duckdb.Error as e:
            print(f"[level {level}] [{i}/{total}] {iso3}: query failed, skipping: {e}", file=sys.stderr)
            continue
        results.extend(rows)

    con.close()
    return results


def write_output(rows: list[tuple[str, int, str, str, int]], output: Path) -> None:
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE new_rows (source VARCHAR, level INTEGER, iso3 VARCHAR, "
        "preferred_source VARCHAR, matched_count BIGINT)"
    )
    con.executemany("INSERT INTO new_rows VALUES (?, ?, ?, ?, ?)", rows)

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".parquet", delete=False) as f:
        tmp_path = Path(f.name)

    if output.exists():
        select_sql = f"""
            SELECT source, level, iso3, preferred_source, matched_count
            FROM (
                SELECT *, 0 AS priority FROM new_rows
                UNION ALL
                SELECT *, 1 AS priority FROM read_parquet('{output}')
            )
            QUALIFY ROW_NUMBER() OVER (PARTITION BY source, level, iso3 ORDER BY priority) = 1
        """
    else:
        select_sql = "SELECT source, level, iso3, preferred_source, matched_count FROM new_rows"

    con.execute(
        f"COPY ( {select_sql} ) TO '{tmp_path}' "
        "(FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15)"
    )
    con.close()
    tmp_path.replace(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--levels", nargs="+", type=int, default=[1, 2, 3, 4])
    parser.add_argument("--threshold", type=float, default=0.9)
    parser.add_argument("--output", type=Path, default=PARQUET_DIR / "source_match.parquet")
    args = parser.parse_args()

    sheet_url = read_sheet_url()
    if not sheet_url:
        print("VITE_DECISIONS_SHEET_URL not set in .env, skipping match-rate computation.", file=sys.stderr)
        return

    decisions = fetch_decisions(sheet_url)

    with ThreadPoolExecutor(max_workers=len(args.levels)) as pool:
        futures = [pool.submit(run_level, level, args.threshold, decisions) for level in args.levels]
        all_rows = [row for future in futures for row in future.result()]

    if not all_rows:
        print("No match-rate rows computed, leaving existing output untouched.", file=sys.stderr)
        return

    write_output(all_rows, args.output)
    print(f"Wrote {len(all_rows)} source match-rate rows for levels {args.levels} -> {args.output}")


if __name__ == "__main__":
    main()
