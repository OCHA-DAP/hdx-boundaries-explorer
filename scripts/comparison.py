# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb"]
# ///
"""Flatten the per-source/level comparison data StatsComparisonTable shows in the UI into a
downloadable dataset. Must run after download:m49/iso3166/mapbox-boundaries/provenance/stats/match."""

from pathlib import Path

import duckdb

PARQUET_DIR = Path("static/parquet")
OUT_PARQUET = PARQUET_DIR / "source_comparison.parquet"
OUT_CSV = PARQUET_DIR / "source_comparison.csv"

COMPARISON_QUERY = f"""
    SELECT
        s.iso3,
        m."Country or Area" AS country_name,
        s.source,
        s.level,
        s.feature_count,
        s.total_vertices,
        s.avg_vertices,
        s.edge_vertices,
        s.internal_vertices,
        p.provider,
        p.source_updated,
        CASE WHEN s.level = 1 THEN i.subdivision_count END AS iso3166_adm1_subdivision_count,
        mb.feature_count AS mapbox_feature_count,
        d.selected_source AS team_selected_source,
        TRY_CAST(d.accepted AS BOOLEAN) AS team_accepted,
        d.rationale AS team_rationale,
        d.last_updated AS team_last_updated,
        match.matched_count,
        CASE WHEN match.matched_count IS NOT NULL AND s.feature_count > 0
            THEN ROUND(100.0 * match.matched_count / s.feature_count, 1) END AS match_rate_pct
    FROM read_parquet('{PARQUET_DIR / "source_stats.parquet"}') s
    JOIN read_parquet('{PARQUET_DIR / "m49.parquet"}') m ON m."ISO-alpha3 Code" = s.iso3
    LEFT JOIN read_parquet('{PARQUET_DIR / "source_provenance.parquet"}') p
        ON p.source = s.source AND p.iso3 = s.iso3
    LEFT JOIN read_parquet('{PARQUET_DIR / "iso3166.parquet"}') i ON i.iso3 = s.iso3
    LEFT JOIN read_parquet('{PARQUET_DIR / "mapbox_boundaries.parquet"}') mb
        ON mb.iso3 = s.iso3 AND mb.level = s.level
    LEFT JOIN decisions d ON d.iso3 = s.iso3
    LEFT JOIN read_parquet('{PARQUET_DIR / "source_match.parquet"}') match
        ON match.source = s.source AND match.level = s.level AND match.iso3 = s.iso3
        AND match.preferred_source = d.selected_source
    ORDER BY s.iso3, s.level, s.source
"""


def read_sheet_url() -> str | None:
    env_path = Path(".env")
    if not env_path.exists():
        return None
    for line in env_path.read_text().splitlines():
        if line.startswith("VITE_DECISIONS_SHEET_URL="):
            return line.split("=", 1)[1].strip()
    return None


def main() -> None:
    con = duckdb.connect()
    sheet_url = read_sheet_url()
    if sheet_url:
        con.execute("LOAD httpfs")
        # Sheet columns vary by submission, same defensive lookup decisions.ts does client-side.
        available = {
            row[0]
            for row in con.execute(
                f"DESCRIBE SELECT * FROM read_csv('{sheet_url}', header=true, all_varchar=true)"
            ).fetchall()
        }
        wanted = ["iso3", "selected_source", "accepted", "rationale", "last_updated"]
        select_cols = ", ".join(c if c in available else f"NULL AS {c}" for c in wanted)
        con.execute(
            f"CREATE TABLE decisions AS SELECT {select_cols} "
            f"FROM read_csv('{sheet_url}', header=true, all_varchar=true)"
        )
    else:
        print("VITE_DECISIONS_SHEET_URL not set, writing comparison data without team decisions")
        con.execute(
            "CREATE TABLE decisions "
            "(iso3 VARCHAR, selected_source VARCHAR, accepted VARCHAR, "
            "rationale VARCHAR, last_updated VARCHAR)"
        )

    con.execute(f"CREATE TABLE comparison AS {COMPARISON_QUERY}")

    OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    con.execute(
        f"COPY comparison TO '{OUT_PARQUET}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 15)"
    )
    con.execute(f"COPY comparison TO '{OUT_CSV}' (HEADER, DELIMITER ',')")
    con.close()

    print(f"Wrote source comparison data → {OUT_PARQUET} and {OUT_CSV}")


if __name__ == "__main__":
    main()
