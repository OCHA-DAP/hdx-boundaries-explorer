#!/usr/bin/env bash
set -euo pipefail

# Vendors a copy of OpenFreeMap's "positron" style, stripped of its
# international/subnational boundary layers (source-layer "boundary") so it
# doesn't compete with this app's own admin boundary overlays.
mkdir -p src/lib/map/basemap

curl -fsSL https://tiles.openfreemap.org/styles/positron |
  jq '.layers |= map(select(.["source-layer"] != "boundary"))' \
    >src/lib/map/basemap/positron.json

npx prettier --write src/lib/map/basemap/positron.json
