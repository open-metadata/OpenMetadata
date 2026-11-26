# Backend CI gates integration-test lanes behind unit tests and builds once

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial) · v2 2026-11-25 (check names and stage reporting)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `test_unified_backend_workflow_builds_it_runtime_once_and_gates_on_unit_tests` in `.github/scripts/tests/test_ci_speed_java_and_cache.py`
- **Related:** PR #38624, ADR:2026-10-19-the-redis-cache-lane-gates-the-merge-queue, ADR:2026-11-24-ci-caches-live-in-ghcr-with-actions-cache-fallback

## Context
Previously, backend CI was split across five separate workflows (`java-checkstyle.yml`, `openmetadata-service-unit-tests.yml`, `maven-sonar-build.yml`, and three standalone Java integration-test workflows). Every backend merge-queue entry compiled the identical `:openmetadata-integration-tests` reactor three separate times and immediately launched all 14 integration-test lanes (~355 runner-minutes) even when formatting or unit tests failed.

## Decision
All Java/Maven backend checks run inside the single `Backend CI` workflow (`.github/workflows/openmetadata-service-unit-tests.yml`) in two stages:

1. **Stage 1 (parallel):** fail-fast Java Checkstyle → `openmetadata-service` unit tests (`openmetadata-service-unit-tests`), `k8s_operator-unit-tests`, `docker-image-smoke-test`, `maven-sonarcloud-ci` (main/nightly/dispatch only), and a single `integration-test-build` job (merge queue/main/dispatch only) that builds and uploads `java-it-build-<run_id>` once.
2. **Stage 2 (parallel, merge queue/main/dispatch only):** all three DB/search profiles (`it-mysql-elasticsearch`, `it-postgres-opensearch`, `it-postgres-elasticsearch-redis` via `.github/workflows/java-integration-lanes-reusable.yml`) reuse that one `java-it-build-<run_id>` artifact and run only when `openmetadata-service-unit-tests` has succeeded or was legitimately skipped (using `!cancelled()` so GitHub's implicit `success()` does not skip Stage 2 on IT-only path changes such as `docker/rdf-store/**`).
3. **Required checks:** the top-level rollup jobs keep the existing required check names (`openmetadata-service-unit-tests`, `integration-tests-mysql-elasticsearch`, `integration-tests-postgres-opensearch`, `integration-tests-postgres-elasticsearch-redis`) so `merge-rules` and `merge_queue_dequeue.py` stay compatible.

## Consequences
Broken merge-queue entries fail fast in Stage 1 without burning ~355 runner-minutes of integration-test lanes, and passing entries avoid two duplicate Maven reactor builds and three duplicate path-filter runners. Passing backend merge-queue entries trade ~20–25 minutes of extra wall-clock latency (Stage 2 waits for Stage 1 unit tests) for that fail-fast compute savings. Any new Stage 2 IT job added to `Backend CI` must include `!cancelled() && needs.changes.result == 'success'` and check `needs.openmetadata-service-unit-tests.result` for both `success` and `skipped`.

## Amendment: check names and stage reporting (2026-11-25)

ADR:2026-11-25-backend-checks-reports-native-stage-failures renames the combined Java job to
`backend-checks`, removes the compatibility placeholder, and makes stage failures visible directly.
References above to the service unit-test job now mean `backend-checks`; the integration-test gates
still accept only success or a legitimate skip. The new record defines the required-check cutover.
