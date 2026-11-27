# dbt warning results map to Failed

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ingestion/tests/unit/test_dbt.py` warning and source-freshness result tests
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/26538

## Context

dbt can report `warn` when an executed data test or source freshness check exceeds
its warning threshold. Mapping this to `Aborted` misrepresents the completed check.
OpenMetadata has no dedicated warning result status.

## Decision

Until a dedicated warning status is supported, ingest dbt `warn` as `Failed`, with
result value `0`. Preserve the dbt message or freshness details. Both
`run_results.json` and `sources.json` use this mapping. Runtime errors and other
unrecognized statuses continue to map to `Aborted`.

## Consequences

Newly ingested warnings participate in failed-test reporting and may trigger
failure alerts. Existing stored results are not rewritten by this change; ingesting
an artifact again uses the new mapping. A future warning status must account for
the backend, UI, and alert consumers before replacing this mapping.
