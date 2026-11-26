# UI Sonar coverage is Jest plus the browser suite from one nightly run

- **Status:** Proposed
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `ui-sonarcloud-nightly.yml` (both lcov reports are written, and the scan is skipped
  without them)
- **Related:** #38648, #38649, open-metadata/openmetadata-collate#8350,
  ADR:2026-11-25-browser-tests-are-selected-before-main-and-run-in-full-on-main

## Context
The UI SonarCloud scan read `src/test/unit/coverage/lcov.info`, but the nightly Jest step
(`test:cov-summary`) wrote only `json-summary`. Every scan logged "No LCOV files were found", so UI
coverage on SonarCloud was empty. Code covered only by the Vitest browser suite would have been missing
from it either way. Pull requests and the merge queue run a selected subset of the browser suite, so
their coverage is not a baseline.

## Decision
- UI coverage on SonarCloud is the union of two lcov reports from one nightly run on main: Jest
  (`src/test/unit/coverage/lcov.info`) and the whole, unsharded browser suite
  (`src/test/browser/coverage/lcov.info`). No pull-request or merge-queue run feeds Sonar.
- A failing test still fails the job and notifies Slack, but the scan runs on the coverage it wrote
  (Vitest's `reportOnFailure`).
- The scan is skipped, and the job fails (so Slack is notified), when the dependency install failed or
  either report is missing. A partial scan would publish a false coverage drop on main.
- The job is capped at 180 minutes (Jest plus about 1,070 browser tests on one runner).

## Consequences
SonarCloud shows real UI coverage, including code only the browser suite reaches. A crashed suite costs
one night's scan rather than recording a false drop. If the unsharded run nears the cap, shard it and
merge the reports before the scan.
