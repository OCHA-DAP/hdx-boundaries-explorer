#!/usr/bin/env bash
set -euo pipefail

# Vendors a copy of OpenFreeMap's "positron" style, stripped of its
# international/subnational boundary layers (source-layer "boundary") and
# country/state name labels (place classes "country"/"state" — OpenMapTiles'
# place layer has no finer admin-name classes below that) so it doesn't
# compete with this app's own admin boundary overlays and labels.
mkdir -p src/lib/map/basemap

admin_label_ids='["label_country_1","label_country_2","label_country_3","label_state"]'

curl -fsSL https://tiles.openfreemap.org/styles/positron |
  jq --argjson adminLabelIds "$admin_label_ids" \
    '.layers |= map(select(.["source-layer"] != "boundary" and (.id as $id | $adminLabelIds | index($id) == null)))' \
    >src/lib/map/basemap/positron.json

npx prettier --write src/lib/map/basemap/positron.json
