# HDX Boundaries Explorer data

The explorer app lives at [ocha-dap.github.io/cod-site/explorer](https://ocha-dap.github.io/cod-site/explorer/), with source in [OCHA-DAP/cod-site](https://github.com/OCHA-DAP/cod-site).

This repo builds the boundary data it reads (`npm run download`) and publishes it to Cloudflare R2 (`npm run sync`). It also deploys `site/` to GitHub Pages, which forwards visitors from `ocha-dap.github.io/hdx-boundaries-explorer/` to the new address, keeping the query string and `#hash`.
