# Python CI selects workloads by event and shares preparation across runners

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial); v2 2026-11-20 (entrypoint ownership); v3 2026-11-23 (runner consolidation)
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

| Event | Unit tests | MySQL/PostgreSQL integration tests | Legacy connector E2E |
| --- | --- | --- | --- |
| Pull request | Highest supported Python | Skipped | Skipped |
| Merge queue | Highest supported Python | Highest supported Python | Skipped |
| Nightly | Full supported matrix | Full supported matrix | Highest supported Python |

Formatting, lint and type checks share one job on the lowest supported Python, with separate
steps and isolated tool environments. Changes that only select formatting/lint do not install
the type-checking environment.

`ci-pr.yml`, `ci-merge-queue.yml` and `ci-nightly.yml` own their respective triggers, workload
selection, Python matrices, dependencies, permissions and required `py-tests-status` check.
The required `py-checkstyle` job also stays in the entrypoints. Reusable workflows execute
the supplied Python version and source revision; they do not choose event policy. Shared
backend construction uses a complete reusable job. Aggregate jobs run on `ubuntu-slim`, verify
the selected results without checking out the repository, and retain the existing required
check names. Other jobs run on `ubuntu-latest`.

The nightly runs at 01:00 UTC. Manual dispatch runs the selected entrypoint's workloads,
bypassing path filtering without simulating a merge-group commit. CI helper and offline E2E
framework meta-tests run only in scheduled and manual nightly workloads,
once on the highest supported interpreter. They are distinct from connector E2E execution;
their failures still fail the nightly status and trigger its Slack notification.

Prepare classification models inside the PR unit runner, restoring immutable default-branch
cache entries and preparing misses without an artifact round trip. Queue and nightly retain
one shared producer and an uncompressed, one-day `classification-models` artifact for their
multiple consumers. Its name and cache identities are unchanged. Only the default-branch warmer
saves persistent model caches. Consumer jobs retain read-only cache access and import archives
before the final classification profile synchronization and verification. Local preparation
reuses the runner's installed uv.

Build one backend distribution per selected integration/nightly run. Both reusable runners consume
the same `openmetadata-backend-distribution` artifact, and server startup skips Maven. Unit tests
run once per selected interpreter, independently of the integration database matrix. Static
checks run once on the minimum interpreter.

`reusable-py-cli-e2e-tests.yml` contains only connector E2E jobs. Preserve the 17 legacy connector lanes,
their test environment, cloud authentication, diagnostics, cleanup and Snowflake concurrency with
V2. The default connector list lives in `ci-nightly.yml`; manual nightly runs may override it with
a JSON array. The V2 workflow remains independent, and connector migration is a separate change.

Selected jobs must succeed; unexpected failures and skips fail the required status. Scheduled
and manual nightly failures notify ingestion Slack and mention `onduty-integrations`; successful
or cancelled runs and PR/merge-queue modes stay silent. Preserve unit, integration and connector
coverage and JUnit results, combining them after the test workflows finish before publishing to Sonar
on main. Use distinct connector coverage and result names to avoid overwriting other lanes.

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
