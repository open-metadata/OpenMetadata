# Pull-request jobs restore caches but never save them

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Ayush Shah
- **Guard:** `test_no_job_reachable_from_pull_request_saves_a_cache` in `.github/scripts/tests/test_ci_speed_java_and_cache.py`
- **Related:** #34944, PR #37493, ADR:2026-11-09-python-classification-models-use-explicit-profiles-and-caches

## Context
A cache saved by a `pull_request` run is scoped to that PR's merge ref: only the same PR's re-runs
can read it. It still counts against the repository's 10 GB cache budget, which GitHub evicts
least-recently-used first. In the week of 2026-11-03 the budget sat at 10.59 GB, held no Playwright
entries, and its oldest entry was 8 hours old; the Playwright golden fixture was rebuilt in 10 of 10
sampled runs (about 25 runner-minutes and 14 minutes of wall-clock each) because PR-scoped Maven,
uv and CodeQL copies pushed the main-scoped caches out.

## Decision
No job reachable from `pull_request` may save a cache — directly (`actions/cache`,
`actions/cache/save`, `setup-*` with `cache:`, setup-uv with saving on, buildx `type=gha`), through
a local composite action or reusable workflow, or through a third-party action known to save
internally. PR jobs restore. Every cache a PR restores has a writer on `push` to the default branch,
`schedule`, or a default-branch `workflow_dispatch`. A composite that saves only when an input such
as `save-cache` is `'true'` complies as long as PR callers leave it off.
`KNOWN_UNOWNED_WRITERS` in the guard lists the exceptions that predate this rule and may only shrink.

## Consequences
Main-scoped caches stay resident, so PRs hit them; a PR's own re-run can no longer reuse a cache its
first run built, and a PR that changes a cache key pays the miss on every push until the change
reaches `main`. A cache with no main-scoped writer gives PRs nothing, so a new cache needs its
writer first (classification models have the default-branch warmer;
`maven-sonar-build.yml` keeps its PR save, allow-listed, until it gains one). Revisit if GitHub
scopes PR caches outside the shared budget.
