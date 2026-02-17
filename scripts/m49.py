#!/usr/bin/env python3
"""Download the UN M49 country/area codes from unstats.un.org."""

import csv
import html.parser
import subprocess
import tempfile
import urllib.request
from pathlib import Path

URL = "https://unstats.un.org/unsd/methodology/m49/overview/"
TABLE_ID = "downloadTableEN"
OUT_PARQUET = Path("static/parquet/m49.parquet")


class TableParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.target = False
        self.nested = 0
        self.in_cell = False
        self.rows, self.row, self.cell = [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table":
            if attrs.get("id") == TABLE_ID:
                self.target = True
            elif self.target:
                self.nested += 1
        if not self.target or self.nested:
            return
        if tag == "tr":
            self.row = []
        elif tag in ("th", "td"):
            self.in_cell, self.cell = True, []

    def handle_endtag(self, tag):
        if tag == "table" and self.target:
            if self.nested:
                self.nested -= 1
            else:
                self.target = False
        if not self.target or self.nested:
            return
        if tag == "tr" and self.row:
            self.rows.append(self.row)
        elif tag in ("th", "td") and self.in_cell:
            self.in_cell = False
            self.row.append("".join(self.cell).strip())

    def handle_data(self, data):
        if self.in_cell:
            self.cell.append(data)


req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as r:
    content = r.read().decode("utf-8")

parser = TableParser()
parser.feed(content)

OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(
    suffix=".csv", mode="w", newline="", encoding="utf-8", delete=False
) as f:
    tmp_path = Path(f.name)
    csv.writer(f).writerows(parser.rows)
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
print(f"Wrote {len(parser.rows) - 1} rows → {OUT_PARQUET}")
