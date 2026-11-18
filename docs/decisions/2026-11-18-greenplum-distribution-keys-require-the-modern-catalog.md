# Greenplum distribution keys require the modern catalog and preserve lookup failures

- **Status:** Superseded by ADR:2026-11-18-greenplum-distribution-lookup-errors-skip-only-the-constraint
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ingestion/tests/unit/topology/database/test_greenplum.py`, `ingestion/tests/integration/greenplum/test_metadata.py`
- **Related:** #34860, #38131

## Context

Greenplum 5 stores distribution columns in `gp_distribution_policy.attrnums`. Greenplum 6 adds
`policytype` and replaces `attrnums` with `distkey`. Querying the modern columns on an older server
would reject metadata that previously followed the existing ingestion path.

## Decision

- Run distribution-key extraction only for the Greenplum 6+ catalog layout. Use SQLAlchemy's cached
  PostgreSQL base version: Greenplum 5 reports 8.3, while Greenplum 6 reports 9.4.
- Hash-distributed tables emit one `DIST_KEY` containing all distribution columns in catalog order.
  Randomly distributed tables, replicated tables, and views emit none.
- On older servers, skip this enrichment and retain the shared constraint-processing path.
- On supported catalogs, propagate lookup failures through the existing table-ingestion error path.
  An unsuccessful read must not be interpreted as an empty distribution policy.

## Consequences

Extraction adds one catalog query per table on supported catalogs, with no separate capability
query or cache. A lookup failure rejects the table request rather than emitting incomplete
constraints. Validation covers Greenplum 6.27.1; full Greenplum 5 or 7 compatibility is not implied.
