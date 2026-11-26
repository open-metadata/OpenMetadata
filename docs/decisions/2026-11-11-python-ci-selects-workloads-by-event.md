# Python CI selects workloads by event and shares preparation across runners

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial); v2 2026-11-20 (entrypoint ownership); v3 2026-11-23 (runner consolidation); v4 2026-11-25 (single PR Python job); v5 2026-11-26 (nightly selection and reporting)
- **Deciders:** Pablo Takara
- **Guard:** reviewer; `actionlint`; `ingestion/tests/cli_e2e_v2/meta/test_ci_workflow.py`
- **Related:** ADR:2026-11-09-python-classification-models-use-explicit-profiles-and-caches; https://github.com/open-metadata/OpenMetadata/issues/35889; https://github.com/open-metadata/OpenMetadata/pull/37562; https://github.com/open-metadata/OpenMetadata/pull/38105

## Context

Repeating the full Python compatibility matrix on every PR increases feedback time. Separate
integration and connector workflows also repeat backend builds, model preparation and Python
unit/integration suites. Connector E2E has its own environment, credentials and concurrency
requirements, so it remains a separate reusable runner.

## Decision

This record supersedes the earlier classification-model record's requirement that Python test
matrices remain unchanged. Its locked-profile, generation, model-selection, archive-integrity,
cache-identity, setup-ordering and warming decisions, including its amendments, remain in force.
Only CI workload selection and shared preparation ownership change here.

`tool.openmetadata.python-environments.supported-python` in `ingestion/pyproject.toml` remains
the source of supported interpreters. Selection reads it without importing ingestion or Nox and
uses numeric minimum/maximum versions rather than list order or separate version declarations.

For relevant changes, select these workloads:

| Event | Unit tests | MySQL/PostgreSQL integration tests | Legacy connector E2E | Operator image smoke test |
| --- | --- | --- | --- | --- |
| Pull request | Highest supported Python | Skipped | Skipped | Skipped |
| Merge queue | Highest supported Python | Highest supported Python | Skipped | Skipped |
| Nightly | Full supported matrix | Full supported matrix | Highest supported Python | Highest supported Python |

Formatting, lint and type checks share one job on the lowest supported Python, with separate
steps and isolated tool environments. Both modes share Python and pinned uv setup. Formatting/lint
uses the style profile; native libraries, ANTLR, generated models and application dependencies are
prepared only for type checks. Airflow API changes alone select formatting/lint without ingestion
type checks. Ruff runs before type prerequisites are installed, so formatting/lint failures stop
the job before application preparation. Nox prepares each selected tool profile when its check
runs; CI does not preinstall it. Static-check logs are uploaded only for a failed type-check step
with an available log, and upload failures do not alter the check result. Ruff targets Python 3.10
independently of its host interpreter.

PR and merge-queue Airflow API tests are selected only by changes to the API module or its composite
action. Shared SDK, schema, backend and tooling changes are covered by the full nightly API run.
Backend-only paths select Python workloads in the merge queue. PRs select ingestion workloads
from Python paths, including model-generation inputs and shared Python build tools.

`ci-pr.yml`, `ci-merge-queue.yml` and `ci-nightly.yml` own their respective triggers, workload
selection, Python matrices, dependencies, permissions and required `py-tests-status` check.
Unit and Airflow API suites are composite actions (`python-unit`, `python-airflow-apis`) that
run on the caller's checkout; each entrypoint owns the job, checkout and source revision. In
`ci-pr.yml`, static checks, unit tests and Airflow API tests run as conditional steps of one
`python` job, and later suites still run after an earlier step fails. That job runs for every
non-draft PR, verifies the selected step results in a final step and publishes `py-checkstyle`
and, only when the Airflow API step ran, `airflow-apis` through the Checks API. Fork PRs receive
a read-only token, so they skip that publishing. The required `py-tests-status` stays a small job
that checks the `python` job and its verification result on every non-draft PR, including forks.
It is never skipped by `if`, because a skipped job reports success and would override a failing
check of the same name. Merge-queue and nightly
keep separate jobs. The nightly entrypoint enables tooling checks on its highest Python version
through the unit action's `run-tooling-tests` input. Shared
backend construction uses a complete reusable job. Merge-queue and nightly aggregate jobs run on `ubuntu-slim`, verify
the selected results without checking out the repository, and retain the required
`py-tests-status` aggregate check. Other Python CI jobs run on `ubuntu-latest`. Playwright
workflows and their cache warmer also use `ubuntu-latest`, with Chromium apt caches keyed by Ubuntu release.

Nightly connector and operator image tests share one ingestion image built at the tested revision, in parallel with
backend and classification preparation. Consumers verify its revision and dependency selection
before using the existing image preload path. The manual v2 connector workflow shares both backend
and ingestion builds within its run. Reusable connector callers can retain per-runner builds.

Stack startup does not prepare or modify host Python environments. Python integration, connector,
and operator jobs explicitly prepare their locked profile after startup; browser jobs use container
ingestion without host Python dependencies. Classification models are verified during Python
preparation. Nox still prepares the selected profile before tests.
The diagnostics action collects evidence before workflow-owned teardown and does not stop services
or delete local data. Test results retain JUnit and outcome metadata;
raw test logs are uploaded for
unsuccessful tests, and coverage text is rendered once centrally in CI.

The nightly runs at 01:00 UTC. Manual dispatch runs the selected entrypoint's workloads,
bypassing path filtering without simulating a merge-group commit. CI helper, Python tooling and
offline E2E framework meta-tests run only in scheduled and manual nightly workloads,
once on the highest supported interpreter. They are distinct from connector E2E execution;
their failures still fail the nightly status and trigger its Slack notification.

Prepare classification models inside the PR unit runner, restoring immutable default-branch
cache entries and preparing misses without an artifact round trip. Queue and nightly retain
one shared producer and an uncompressed, one-day `classification-models` artifact for their
multiple consumers. Its name and cache identities are unchanged. Only the default-branch warmer
saves persistent model caches. Consumer jobs retain read-only cache access and import archives
before the final classification profile synchronization and verification. Local preparation
reuses the runner's installed uv.

Build one backend image per selected integration/nightly run. Integration, API and connector
runners load the same `ci-backend-image` artifact, verify its source revision, and reuse
it for both migration and server containers. Server startup skips Maven and backend image builds.
Unit tests run once per selected interpreter, independently of the integration database matrix.
Static checks run once on the minimum interpreter.

`reusable-py-cli-e2e-tests.yml` contains only connector E2E jobs. Preserve the 17 legacy connector lanes,
their test environment, cloud authentication, diagnostics and Snowflake concurrency with
V2. The default connector list lives in `ci-nightly.yml`; manual nightly runs may override it with
a JSON array. The manual V2 entrypoint validates its connector selection before building images
and calls the same reusable runner with `test-suite: v2`, without collecting coverage during
stabilization. Both suites use the highest supported interpreter and Nox's `cli-e2e` session,
with shared reporting, failure diagnostics, a 90-minute job limit and stack teardown. V2 retains
its contract checks and connector worker counts. Connector migration remains a separate change.

The operator image build and sample-data smoke test runs only through `ci-nightly`, including
manual nightly dispatches, on the highest supported Python with a 90-minute job limit. It reuses the shared backend and
ingestion images for stack startup, then builds its own `ingestion-base` image and runs ingestion
twice to validate sample data and stable entity IDs. Its result participates in the nightly gate
and failure notification. Image packaging failures may therefore merge before the next nightly.

Selected jobs must succeed; unexpected failures and skips fail the required status. Scheduled
and manual nightly failures notify ingestion Slack and mention `onduty-integrations`; successful
or cancelled runs and PR/merge-queue modes stay silent. Preserve unit, integration and connector
coverage and JUnit results, combining them after the test workflows finish before publishing to Sonar
on main. Use distinct connector coverage and result names to avoid overwriting other lanes.
PR, queue and manual nightly runs outside main disable coverage instrumentation. On main, nightly collects coverage from the lowest
Python unit runner, the lowest Python MySQL integration shards, and the legacy connector runners;
the remaining compatibility jobs still publish JUnit results without collecting coverage.

## Consequences

PRs avoid integration infrastructure and the full compatibility matrix. Merge queue still gates
on both integration databases at the highest supported version; failures specific to lower
supported versions surface in nightly runs. E2E meta-suite runtime stays out of PR and merge-queue
checks; framework regressions may therefore remain undetected until nightly. Connector E2E runs
once per connector, rather than across the Python/database matrix, and still requires isolated
server environments.

Shared preparation removes repeated model preparation and backend builds. A preparation failure
blocks its consumers and fails the required status. Manual dispatch validates the workloads;
hosted merge-group events are still needed to validate merge commits and base-SHA path filtering.

## Amendment: nightly selection and reporting (2026-11-26)

The scheduled run selects all Java and Python workloads. Manual runs can select `all`, `java`,
`python`, or `connectors`. The Python selection includes connector E2E. The connector selection
runs connector E2E and its image and model preparation with coverage disabled. Java and Python
Sonar publication is restricted to `main`.

One final nightly job verifies the selected results and writes a workflow summary. On a failure it
posts the failed and incomplete jobs to Slack with a link to the run. Alerts mention the ingestion
on-call team when a Python workload or its preparation fails.
