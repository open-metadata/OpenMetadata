# CI dependency caches live in GHCR with Actions-cache fallback

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `test_ghcr_cache_pulls_authenticate_with_github_token` in `.github/scripts/tests/test_ci_speed_java_and_cache.py` and `test_ci_m2_cache_disables_attestations_so_untagged_prune_is_safe` in `.github/scripts/tests/test_prune_ghcr_package.py`
- **Related:** PR #38624, ADR:2026-11-11-pull-request-jobs-restore-caches-but-never-save-them

## Context
GitHub Actions enforces a shared 10 GB LRU cache quota per repository. Measured on `open-metadata/OpenMetadata`, active Actions caches sat at 10.05 GB / 10 GB — dominated by CodeQL databases (~3.7 GB), two ~1.3 GB `playwright-ingestion-image` tarballs (~2.6 GB), `yarn-pkg-cache` (~1.85 GB), and `~/.m2` (~0.7–0.8 GB) — causing constant LRU eviction and cold Maven / fixture rebuilds across PR and merge-queue runs.

## Decision
Heavy CI dependency caches that do not depend on per-PR diffs live in GHCR under the repository owner's namespace instead of consuming the 10 GB Actions cache cap:

1. **Maven repository cache (`ghcr.io/<owner>/ci-m2-cache:main`):** built and pushed only from `push` to `main` (on `**/pom.xml` changes), daily schedule, or `workflow_dispatch` via `.github/workflows/ci-builder-images.yml` (`docker/ci/Dockerfile.m2-cache`). Reactor `org/open-metadata` SNAPSHOTs are stripped so builds never read stale artifacts. Consumers call `.github/actions/hydrate-maven-cache` (restore-only: exact Actions cache → authenticated GHCR pull via `docker cp` into `~/.m2/repository` → Actions prefix fallback).
2. **Playwright ingestion image (`ghcr.io/<owner>/ci-playwright-ingestion:<fingerprint>`):** built and pushed only from non-PR, non-`merge_group` runs (`populate-playwright-caches.yml` / schedule / dispatch) via `.github/workflows/reusable-playwright-e2e.yml`. Consumers authenticate to `ghcr.io` with read-only `GITHUB_TOKEN` (`packages: read`) before pulling and fall back to `actions/cache/restore@v6` during cutover or if GHCR misses.
3. **Authentication:** Because newly created GHCR packages default to private until an admin makes them public, every GHCR pull authenticates with the job's read-only `GITHUB_TOKEN` (`packages: read`), which passes PR workflow security checks and reads same-repo packages regardless of visibility.
4. **Retention & pruning:** GHCR has no native TTL, so `.github/scripts/prune_ghcr_package.py` runs immediately after each publisher push (and daily in `ci-builder-images.yml`) to delete all untagged/dangling manifests, keep only `:main` on `ci-m2-cache`, and keep only the newest tag plus at most one previous tag within a 2-hour overlap grace window on `ci-playwright-ingestion` (~2 GB steady-state footprint; $0/month once packages are set to Public).

## Consequences
Moving `~/.m2` hydration and Playwright's ~1.3 GB ingestion images to GHCR keeps ~3.4 GB out of the 10 GB Actions cache budget and avoids Docker-in-Docker mount mismatches on Testcontainers runners (which stay on the host VM and copy `/m2/repository` from the `scratch` image). New callers of `hydrate-maven-cache` or `reusable-playwright-e2e.yml` must declare `packages: read` in their job/workflow permissions. Revisit only if GitHub raises the repository Actions cache quota enough to hold all caches comfortably without LRU eviction.
