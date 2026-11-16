# Visual regression and RDF run as blocking lanes of the main Playwright workflow, and visual renders the regular UI bundle

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `.github/scripts/tests/test_playwright_ci_planning.py` (lane gating), `.github/scripts/tests/test_playwright_cache_assets.py`; reviewer for the bundle default
- **Related:** #35534, #35902, #35787

## Context
Visual regression and the Knowledge Graph / Ontology RDF suites ran in their own workflows, each
building the server and UI again and reporting outside `playwright-summary`, so a break there did
not stop a merge. Folding them into the main workflow lets them reuse its single build. Visual first
failed on the shared build because CI built the coarse bundle (`PW_E2E_BUNDLE`). That bundle folds
lazy pages into the eager chunk, so their CSS loads before the global CSS. Ties between equally
specific rules then resolve differently from production: settings pages lose a 4px header margin,
and the explore page loses its fixed height. Re-enabling `cssCodeSplit` or reordering the
stylesheets only moves the tie somewhere else.

## Decision
- `visual` and `rdf` are lanes of `playwright-e2e-reusable.yml`, and their shards count toward
  `playwright-summary`, so a failure blocks the merge. `visual` runs when its UI path filter matches,
  `rdf` when its RDF path filter matches, and both run on every manual and scheduled run. Neither
  runs on `protocol=h2`, because both start plain-HTTP Docker servers.
- Each lane seeds its own environment (visual: MySQL; RDF: Postgres + Fuseki) because the shared
  fixture carries other lanes' data. Both reuse the shared distribution and ingestion image.
- `coarse_bundle` stays on by default for every other lane. `visual` always renders the regular
  bundle: `build-visual-ui` builds it (`PW_E2E_BUILD` without `PW_E2E_BUNDLE`, cached under the
  `pw-e2e-build` UI-dist variant), and the visual shard serves it with
  `.github/scripts/serve_playwright_ui.cjs` in front of the shared server, proxying `/api`, and
  points `PLAYWRIGHT_TEST_BASE_URL` at it. Re-capturing the baselines on the coarse bundle was
  rejected: they would record a rendering production never shows.
- SSO login stays a separate workflow.

## Consequences
One server build serves every lane, plus one UI-only build, cached and parallel to the server build,
when the visual lane runs. A visual or RDF break blocks the merge queue the same way a functional
failure does. Functional specs still run on the coarse bundle and so still see its CSS order. Measured
locally, 5 of 19 visual baselines differ by more than the 1% tolerance between the two bundles, and
production renders the regular one. `build-visual-ui` and the static server can go once the coarse
bundle keeps production CSS order, or once coarse is no longer the default.
