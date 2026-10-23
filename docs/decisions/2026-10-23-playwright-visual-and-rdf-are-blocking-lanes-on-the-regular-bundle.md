# Visual regression and RDF run as blocking lanes of the main Playwright workflow, on the regular UI bundle

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
- `coarse_bundle` defaults to false in the reusable workflow, every caller and the cache warm-up.
  The coarse bundle stays opt-in for measurement, and `visual` never runs on it.
- SSO login stays a separate workflow.

## Consequences
One build serves every lane. A visual or RDF break blocks the merge queue the same way a functional
failure does, and functional specs now see the CSS cascade production renders. The full-suite run on
#35902 measured the regular bundle against the last three coarse nightlies: slowest shard 26.4m
against 25.1–28.6m. Revisit the default only if the coarse bundle keeps production CSS order and
three consecutive full runs meet the thresholds in `evaluate_playwright_performance.py`.
