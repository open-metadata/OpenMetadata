# Python CI selects workloads by event and shares preparation across runners

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Pablo Takara
- **Guard:** reviewer; `actionlint`; `ingestion/tests/cli_e2e_v2/meta/test_ci_workflow.py`
- **Related:** ADR:2026-11-09-python-classification-models-use-explicit-profiles-and-caches; https://github.com/open-metadata/OpenMetadata/issues/35889; https://github.com/open-metadata/OpenMetadata/pull/37562

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

| Event | Unit tests | MySQL/PostgreSQL integration tests | Legacy connector E2E | Static checks |
| --- | --- | --- | --- | --- |
| Pull request | Highest supported Python | Skipped | Skipped | Lowest supported Python |
| Merge queue | Highest supported Python | Highest supported Python | Skipped | Lowest supported Python |
| Nightly | Full supported matrix | Full supported matrix | Highest supported Python | Lowest supported Python |

`py-tests.yml` owns event triggers, path selection and the required `py-tests-status` check.
The nightly runs at 01:00 UTC. Manual dispatch selects `pull-request`, `merge-queue` or `nightly`
workloads, defaulting to `nightly`; it bypasses path filtering and does not simulate a merge-group
commit. Relevant offline E2E framework meta-tests continue to run with unit tests on PRs and
merge-queue runs; they are distinct from connector E2E execution.

Prepare classification models once in the entrypoint, restoring immutable default-branch cache
entries and preparing misses. Upload one uncompressed, one-day `classification-models` artifact
for the run; its name and cache identities are unchanged. Only the default-branch warmer saves
persistent model caches. Consumer jobs retain read-only cache access and import archives before
the final classification profile synchronization and verification.

Build one backend distribution per selected integration/nightly run. Both reusable runners consume
the same `openmetadata-backend-distribution` artifact, and server startup skips Maven. Unit tests
run once per selected interpreter, independently of the integration database matrix. Static
checks run once on the minimum interpreter.

`py-cli-e2e-tests.yml` contains only connector E2E jobs. Preserve the 17 legacy connector lanes,
their test environment, cloud authentication, diagnostics, cleanup and Snowflake concurrency with
V2. The default connector list lives in `py-tests.yml`; manual nightly runs may override it with
a JSON array. The V2 workflow remains independent, and connector migration is a separate change.

Selected jobs must succeed; unexpected failures and skips fail the required status. Scheduled
and manual nightly failures notify ingestion Slack and mention `onduty-integrations`; successful
or cancelled runs and PR/merge-queue modes stay silent. Preserve unit, integration and connector
coverage and JUnit results, combining them after both runners finish before publishing to Sonar
on main. Use distinct connector coverage and result names to avoid overwriting other lanes.

## Consequences

PRs avoid integration infrastructure and the full compatibility matrix. Merge queue still gates
on both integration databases at the highest supported version; failures specific to lower
supported versions surface in nightly runs. Connector E2E runs once per connector, rather than
across the Python/database matrix, and still requires isolated server environments.

Shared preparation removes repeated model preparation and backend builds. A preparation failure
blocks its consumers and fails the required status. Manual dispatch validates the workloads;
hosted merge-group events are still needed to validate merge commits and base-SHA path filtering.
