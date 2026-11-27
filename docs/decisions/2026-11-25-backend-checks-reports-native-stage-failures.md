# Backend checks report failures at the stage that failed

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial) · v2 2026-11-26 (Java rollup cutover) · v3 2026-11-27 (shared gate)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `test_java_checkstyle_is_unified_fail_fast_in_backend_job`, `test_merge_queue_backend_gate_verifies_selected_integration_jobs`, and `test_summary_leads_with_stage_results`
- **Related:** ADR:2026-11-24-backend-ci-gates-integration-lanes-behind-unit-tests-and-builds-once

## Context

The combined Java job still appeared as `openmetadata-service-unit-tests`, alongside a skipped
`java-checkstyle` compatibility job. Its `continue-on-error` steps showed green even when tests
failed, and the final enforcement step was the only red step. This obscured which checks ran
and where the failure occurred.

## Decision

The combined Java job is `backend-checks`, with numbered checkstyle and service unit-test steps.
Remove the `java-checkstyle` placeholder. Let both validation steps fail natively so GitHub
shows the failing stage in red; checkstyle failure still prevents service tests from running.
Run the summary with `always()` and upload failed-test reports with `failure()`. The summary
leads with the stage outcomes, followed by counts, file names, and failing test methods.

Integration-test lanes and their result gates depend on `backend-checks`. The distinct rollup
for backend checks, operator tests, and the Docker smoke test becomes `backend-checks-status`;
it still catches failures or unexpected skips in those independent jobs. No validation is
moved into a privileged workflow or given additional token permissions.

## Consequences

The workflow filename stays `openmetadata-service-unit-tests.yml` so path filters and callers
remain stable. Stage gating and integration-test scheduling keep the contract in the related ADR.
Merge-queue diagnosis recognizes the renamed rollup and reports the actual failed check.

The GitHub `merge-rules` ruleset (ID `6520078`) is external to the repository. Coordinate its
cutover with deployment: once the rollout PR reports `backend-checks`, replace the required
`java-checkstyle` and `openmetadata-service-unit-tests` contexts with `backend-checks`, keeping
GitHub Actions integration ID `15368` and all unrelated rules unchanged. Then land the workflow
and refresh affected PRs so they report the new name. Do not remove the old requirements before
the replacement check exists. If a ruleset requires the old `openmetadata-service-unit-tests-status`
rollup, rename that requirement to `backend-checks-status` as well. The source change alone does
not update GitHub settings or historical runs.

## Amendment: Java rollup cutover (2026-11-26)

`backend-checks-status` verifies the Java integration build and all selected Java integration
profiles in `ci-merge-queue`, along with checkstyle, service unit tests, operator tests, and Docker
smoke. The PR version verifies the Java workloads selected on PRs.

`backend-checks` runs after a successful plan selects Java checks. The rollup reports planning
failures and verifies the results of the selected jobs.

The rollout removes the three profile status jobs and their PR placeholders. Before merging the
rollout PR, replace the three required `integration-tests-*` contexts with `backend-checks-status`
in `merge-rules`. Keep `backend-checks` required for early failures. Requiring the rollup also
makes operator tests and Docker smoke merge-blocking when selected.

## Amendment: shared gate (2026-11-27)

`backend-checks-status` verifies its jobs through `ci-status-gate`, under
ADR:2026-11-27-ci-components-share-one-status-gate-that-always-runs. On pull requests it runs on
every non-draft PR, not only when Java work is selected. Each expected result follows the planner
output of that job's own `if`, so `backend-checks` follows `checkstyle`, and a job that runs
without being selected now fails the rollup.
