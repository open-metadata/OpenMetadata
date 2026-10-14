# CI: one pipeline, a merge gate that verifies failures, and the AI around it

How pull requests and merge-queue entries are tested, how the queue decides whether a
failure belongs to the entry, and how to operate, measure and roll it back. The design
records are ADR:2026-10-13-merge-queue-entries-are-decided-by-the-merge-gate-status,
ADR:2026-10-13-a-queue-failure-is-forgiven-only-when-the-same-run-proves-it-is-not-the-entrys,
ADR:2026-10-13-one-ci-workflow-builds-once-and-static-checks-gate-every-suite,
ADR:2026-10-13-ci-ai-output-is-advisory-and-never-decides-a-merge and
ADR:2026-10-13-queue-conflicts-are-requeued-or-resolved-by-ci.

**Status:** shadow. `ci.yml` and `merge-gate.yml` run beside the existing workflows and
post `merge-gate (shadow)`, which no ruleset requires. The live queue is unchanged until
the cutover below.

## Stages

| Stage | What runs | Gate |
|---|---|---|
| Local | impact-mapped Java and Playwright runs (`make java_affected_run`, `make playwright_affected`) | the PR-body results block |
| PR | `ci.yml`: static checks, then Java unit (service, k8s operator, server-image smoke), Jest (3 shards) and Python unit (3.10) in parallel | `merge-gate` follows the run, re-running jobs that failed on a blip |
| Merge queue | the same run: one reactor build, IT lanes (MySQL+Elasticsearch, PostgreSQL+OpenSearch), Playwright, Python integration (3.10), then verification of failures | `merge-gate` decided from the run's evidence |
| Nightly | Redis cache profile, Python 3.11/3.12 and PostgreSQL (`nightly.yml` dispatches the existing workflows); full Playwright with main health (`playwright-postgresql-e2e.yml`'s schedule) | each workflow's own reporting; a nightly summary naming the SHA range since the last green run is a follow-up |

Order inside a run: `plan` → static checks ∥ builds → suites → `verify / *` (queue
only, failures only) → `ci-summary`. A static-check failure stops the run before any suite
starts: PR runs cancel themselves (`fail-fast`), queue runs skip their suites through
`needs:` (queue runs never self-cancel; stale queue runs are cancelled centrally,
ADR:2026-10-13-stale-merge-queue-runs-are-cancelled-by-a-central-sweep).

The static checks are the old required checks' own commands: `static / java` is
`mvn spotless:apply` plus a clean diff, `static / python` is `make py_format_check`, and
`static / ui` calls `ui-checkstyle.yml` itself (lint, licence headers, i18n, app docs,
core components, Tailwind audit, bundle budget and runtime, deprecation guard), so the
gate and the old check cannot disagree. `unit / java` calls
`openmetadata-service-unit-tests.yml` the same way. Measured on recent PR runs
(October 2026): UI checkstyle p50 6.9 min / p90 8.2 min (n=23), Jest p50 19.4 min / p90
22.3 min unsharded (n=24). Jest runs in three shards without coverage, since nothing
gates on it (`jest.config.js` has no threshold); the shard times are a projection until
the shadow period measures them.

## The merge gate

`merge-gate.yml` runs on every finished CI run (`workflow_run`), every 10 minutes (the
sweep decides runs whose head has no status), and by hand. It runs main's code only.

| Evidence in the run | Verdict |
|---|---|
| no failed job | pass |
| infra signature in the annotations, or in the failed step's log for a job with no test evidence (setup or install step, runner lost, artifact 403/409, apt budget, network or registry errors, exit 124/137/143, container not ready), or a failed `verify / *` job | re-run only those jobs, up to attempt 2; then **fail** if the same job passed on the parent commit's run, else **hold** (pending) and alert |
| a job with no test evidence and no known signature | re-run once (attempt 2); then **fail**, unless the triage call reads its log as a blip: one more run (attempt 3) |
| every failing test forgiven by verification | pass, listing the forgiven tests |
| any test reproducing on the entry and never on its parent | **fail** |
| more failing tests than the suite's cap (Java IT 20, Python 20, Playwright 10), a static check, a compile error, a build/commit mismatch | **fail** without re-running |
| the entry's diff touches `.github/**`, `.claude/**`, failsafe/Playwright/pytest config | **strict**: no failure is forgiven; blips are still re-run |

Thresholds, signatures and budgets live in `.github/merge-gate/policy.json`; the decision
is `.github/scripts/merge_gate_policy.py` and is pinned by
`.github/scripts/tests/test_merge_gate_policy.py`.

A run outside the shadow sample (its `plan` job ran the `Not sampled` step) skipped every
suite, so the gate posts nothing for it rather than a pass. Sampling only applies in
`shadow` mode: with `MERGE_GATE_MODE` at `enforce` or `strict`, every run is tested.

### Network blips and other transient failures

A blip should cost a re-run, not a PR's place in the queue or its author's time. In order:

1. **Inside a test**: the failing test is re-run by verification and forgiven as flaky
   when it passes; failsafe and Playwright also retry once inside the job.
2. **Known signature**: connection resets, DNS and TLS failures, registry 429/5xx (Maven,
   npm, PyPI, Docker, GitHub, Ubuntu mirrors), runner loss, failed setup or install steps.
   Matched in the annotations, and for a job with no test report in the tail of its failed
   step's log. The job is re-run without asking anyone.
3. **Unrecognised**: a job with no test report whose log matches no signature and shows no
   failing tests (`testFailureMarkers`). With `CI_AI_TRIAGE_MODE=on`, one triage call
   (`ci_ai/triage.py`) reads the redacted excerpt; a "transient" answer must quote the log
   line it rests on, or it counts as unsure. It earns one more re-run, never a pass
   (ADR:2026-10-13-ci-ai-output-is-advisory-and-never-decides-a-merge). In the queue it is
   asked only after the blind retry fails; on PR runs, which get no blind retry, at once.

PR runs follow the same rules: a job that failed on infrastructure is re-run (budgets:
3 a day per PR, 20 an hour across PRs) and the status stays pending meanwhile; test,
static and unexplained failures, and cancelled jobs, are left to the author. A run whose
PR has a newer head is skipped. In `shadow` triage mode every unexplained failure is read
and the answer only reported, so its accuracy can be checked against what the re-runs did.

### Verification (same run)

`verify_failures.py` re-runs only the failing tests:

| Entry re-runs (≤3, stop at first pass) | Parent re-runs (≤3, stop at first failure) | Class | Forgiven |
|---|---|---|---|
| 0 failed | — | flaky | yes |
| ≥1 failed | ≥1 failed | pre-existing | yes |
| ≥2 of 3 failed | 0 failed | introduced | **no** |
| 1 failed | 0 failed | ambiguous | only with independent history and no impact-map link |

Java IT failures are verified in `verify / java-it` against the entry and the parent commit
(`merge_group.base_sha`, rebuilt in the job). Playwright and Python re-run their failures
inside the failed shard while its environment is up (the reusables' `verify_failures`
input). **v1 gap:** Playwright and Python have no parent control yet, so a failure that
reproduces on the entry counts as the entry's. The shadow period measures how often that
happens before the parent build is added for them.

Playwright retries a failing test once inside the shard (`retries: 1`): one that passes
on that retry leaves the job green, as the verify table would also forgive it, and the
reports still list it as flaky. Java ITs get no in-job retry: failsafe re-runs a failing
test after the IT harness has shut its server and database pool down, so the re-run
always errors. Every Java verification attempt is a fresh JVM instead, and
`classify_test_outcome.py` lists any `flakyTests` a suite does report.

Every verified test, and every test a suite reports as flaky, is recorded on an append-only
ledger (`ledger.jsonl` on the `ci/merge-gate` data branch, rolling 30 days, size-capped;
`merge_gate_registry.py`).
Entries built on the same parent reuse a recorded parent control instead of rebuilding
the parent, and the ledger's independent history breaks the ambiguous tie. Forgiven
failures become `flaky-test` issues (`broken-main` when the parent was main's tip), owned
through CODEOWNERS; the issue is closed by its fix and reopens if the failure recurs.

Admin follow-ups: restrict pushes to `ci/merge-gate` to the gate App (a forged ledger
record could let verification skip a parent control), and give
`/openmetadata-integration-tests/` a CODEOWNERS owner — Java IT issues have none today.

## Conflicts

`ci-conflict-resolve.yml` (ADR:2026-10-13-queue-conflicts-are-requeued-or-resolved-by-ci):
a `queue conflict` PR is re-queued unchanged once the entry it clashed with leaves (at
most 3 times a day); a `merge conflict` PR gets main merged in, generated files, lockfiles
and locale JSON resolved mechanically (`conflict_resolvers.py`), the rest resolved by
Claude editing only the conflicted files, then checked (markers, scope, dropped lines),
verified in a job with no secrets, and pushed by the publish App. Only a purely mechanical
resolution re-queues itself; a person re-queues anything a model edited.

## AI

Advisory only (ADR:2026-10-13-ci-ai-output-is-advisory-and-never-decides-a-merge):
explanations of ejections, fixes for flaky tests, `/ci-fix` on request, conflict
resolution. No model output is an input to the gate.

## Switches

| Repository variable | Values | Default |
|---|---|---|
| `MERGE_GATE_MODE` | `shadow` · `enforce` · `strict` (kill switch: no forgiveness, no re-runs) | `shadow` |
| `CI_SHADOW_PR_PERCENT` / `CI_SHADOW_MQ_PERCENT` | share of PRs whose shadow `ci.yml` runs | 100 / 25 |
| `MERGE_GATE_REGISTRY` | `off` · `dry-run` · `on`: ledger records on the `ci/merge-gate` data branch and `flaky-test`/`broken-main` issues | `dry-run` |
| `CI_CONFLICT_MODE` | `off` · `dry-run` · `on` | `dry-run` |
| `CI_AI_MODE` | `off` · `shadow` · `on`: the advisory roles (explain, `/ci-fix`, conflicts) | unset (off) |
| `CI_AI_TRIAGE_MODE` | `off` · `shadow` (answers reported only) · `on` (a blip earns a re-run) | unset (off) |
| `CI_AI_TRIAGE_MODEL` / `CI_AI_TRIAGE_EFFORT` / `CI_AI_DAILY_TRIAGE_MAX` | the triage model, its effort, and calls per day | `claude-opus-5-5` / `low` / 100 |
| `MERGE_GATE_APP_ID` + secret `MERGE_GATE_APP_KEY` | the App whose status the ruleset pins in enforce mode | unset |
| `MQ_SLACK_CHANNEL` + secret `COLLATE_BOT_SLACK_TOKEN` (shared with the queue health alert) | where the gate reports an entry it holds (enforce and strict modes only) | already set |
| `CI_PUBLISH_APP_ID` + secret `CI_PUBLISH_APP_KEY` | the App that pushes conflict resolutions (no `workflows` permission) | unset |
| environment `ci-ai`, secret `CI_AI_ANTHROPIC_API_KEY` | key of the dedicated Console workspace whose monthly limit is the AI spend cap. The gate's decide and sweep jobs use the environment without a deployment (`deployment: false`), so it must allow only `main` and have no reviewers or wait timer | unset |

## Testing workflow changes locally

`.github/scripts/ci_local.py` runs the workflows with [act](https://nektosact.com)
(`brew install act`, Docker running; it uses `uv` for PyYAML when that is missing):

```bash
python3 .github/scripts/ci_local.py scenarios   # the job graphs: 18 scenarios, ~40 s
python3 .github/scripts/ci_local.py job static-ci   # one job as written, after the jobs it needs
python3 .github/scripts/ci_local.py list
```

- `scenarios` keeps the real graph of `ci.yml` and `merge-gate.yml` (needs, ifs, outputs,
  matrices, and the plan job's sampling step) and swaps each job's work for a stub that
  passes or fails on cue; every scenario states each job's expected result. Four
  deliberately broken copies of `ci.yml` (no manual-run override, verification on a manual
  run, a suite missing a static gate, a queue run cancelling itself) each fail one.
- `job` runs one job unchanged in a throwaway copy of the working tree with two commits,
  main's HEAD and then the working tree's changes, so the queue path filter sees exactly
  this change. `plan`, `static-json`, `static-python`, `static-ci` and `ci-summary` take
  one to three minutes (the first run pulls a 1 GB image). The Java and UI checks, the
  suites and verification need a hosted runner's toolchain, services and memory.
- `--workflows DIR` tests workflows not yet in `.github/workflows` (`target/ci-workflows`).
- Not covered locally: event delivery (`workflow_run`, merge-queue refs), the gate's
  GitHub API calls (its tests use a fake GitHub), permissions (a guard test checks what
  `ci.yml` grants the workflows it calls) and secrets.

## Measuring

```bash
# Archive failed queue evidence before it expires (Playwright 3 d, Java 7 d, Python 14 d)
GH_TOKEN=$(gh auth token) python3 .github/scripts/ci_evidence_harvest.py --since 2026-10-06 --suites java-it,python,playwright
# What the gate's first stage would have done over that history
python3 .github/scripts/merge_gate_replay.py --records target/ci-replay
# Baseline: queue outcomes (full count), CI cost per PR head and per entry (sampled)
GH_TOKEN=$(gh auth token) python3 .github/scripts/ci_metrics.py baseline --since 2026-09-29 --until 2026-10-13 --out target/ci-metrics
# Shadow comparison: the old required checks' verdict against ci.yml and merge-gate (shadow)
GH_TOKEN=$(gh auth token) python3 .github/scripts/ci_metrics.py compare --since 2026-10-14 --until 2026-10-28 --out target/ci-compare \
  --old-workflows integration-tests-mysql-elasticsearch.yml,integration-tests-postgres-opensearch.yml,java-checkstyle.yml,playwright-postgresql-e2e.yml,py-checkstyle.yml,py-tests-postgres.yml,py-tests.yml,ui-checkstyle.yml,yarn-coverage.yml
```

Windows are at most 31 days and start at most 90 days back; use a past `--until` for
repeatable samples. `compare` leaves out commits whose `ci.yml` run was outside the shadow
sample. A queue ejection counts as false when the PR later merged with the same head it was
ejected with.

Baseline, 2026-09-29 → 10-13: 1,405 queue entries for 493 PRs; 32.4% of entries had a
failed required check; merged PRs needed 2.86 entries on average; replaying the gate's
first stage over the 365 harvested failed attempts sent 67% to verification, 10% to infra
re-runs and ejected 12% outright. A two-day `ci_metrics.py` smoke run (10-12 → 10-13) found
10 of the 17 `failed_checks` ejections whose PR had since merged going back in with the
same head: a small sample, to be re-measured over the full window.

## Cutover and rollback

1. Shadow for at least two weeks, 300 PR heads and 150 queue entries; compare with
   `ci_metrics.py compare`; run the fault-injection PRs (formatting break, deterministic
   regression, 50% flaky test, broken-on-main test, broken setup step, conflicts).
2. An admin backs up the ruleset JSON and adds the App-pinned `merge-gate` next to the
   eight existing required checks (`java-checkstyle`, `py-checkstyle`, `ui-checkstyle`,
   `ui-coverage`, `integration-tests-mysql-elasticsearch`,
   `integration-tests-postgres-opensearch`, `py-tests-status`, `playwright-summary`);
   set `MERGE_GATE_MODE=enforce`, which also turns sampling off.
3. After about three days of both green, drain the queue, remove the eight checks from
   the `merge-rules` ruleset, and merge one cutover PR to main:

   | Workflow on main | Cutover change | Why it is not just deleted |
   |---|---|---|
   | `java-checkstyle.yml`, `py-checkstyle.yml`, `validate-jsons-yamls.yml`, `yarn-coverage.yml`, `integration-tests-mysql-elasticsearch.yml`, `integration-tests-postgres-opensearch.yml` | delete | — |
   | `ui-checkstyle.yml`, `openmetadata-service-unit-tests.yml` | keep only `workflow_call` | `ci.yml` calls them |
   | `playwright-postgresql-e2e.yml` | drop `pull_request` and `merge_group` | its schedule is the nightly full suite and main health |
   | `py-tests.yml`, `py-tests-postgres.yml` | keep only `workflow_dispatch` | `nightly.yml` dispatches them |
   | `maven-sonar-build.yml` | delete | runs with `sonar.skip=true` today |

   Never `gh workflow disable` these: disabling is per workflow file across every
   branch, and the `1.13.x`/`2.0.x` rulesets still require checks from those files.
   Release branches keep their own copies, which a cutover on main does not touch.

Rollback: revert the cutover PR, restore the ruleset JSON, set `MERGE_GATE_MODE=strict`.

Not replaced by `ci.yml` yet, and left running as they are: the path-gated suites
(`playwright-visual.yml`, `playwright-knowledge-graph-postgresql-e2e.yml`,
`playwright-sso-login-nightly.yml`, `data-access-request-e2e.yml`, `airflow-apis-tests.yml`,
`py-operator-build-test.yml`, `typescript-type-generation.yml`,
`validate-docker-compose-quickstart.yml`), the advisory `maven-build-collate.yml`, and the
repository's process workflows (labels, PR metadata, dequeue report, harness checks).
None of them is a required check. Folding the path-gated suites in is the next step after
the cutover.

## Known issues

Deleting `yarn-coverage.yml` at the cutover ends the SonarCloud scan of UI pull requests
(it is not a required check, and nothing scans the UI on main). Keep that workflow for
Sonar alone, or add a Sonar job to `ci.yml`; this is decided before the cutover.

Seven tests of the CI scripts already failed on main before `workflow-scripts-tests.yml`
started running them: stale workflow-text assertions in `test_playwright_ci_planning.py`
×3 and `test_playwright_merge_group_validation.py`, a behaviour change in
`test_merge_queue_recovery_metrics.py`, and two impact-map ownership checks in
`test_plan_local_java_tests.py` (`IdBatchesIT` belongs to no area). Their owners decide
whether the test or the code is right.

`ci_metrics.py` reads PR heads from `team-labeler.yml` runs (one per push) and merge groups
from `java-checkstyle.yml` runs; after the cutover deletes `java-checkstyle.yml`, pass
`--merge-group-anchor ci.yml`.
