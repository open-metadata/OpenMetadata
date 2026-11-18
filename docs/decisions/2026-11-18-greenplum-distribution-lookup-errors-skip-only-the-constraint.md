# A Greenplum distribution lookup error skips the constraint and preserves table ingestion

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ingestion/tests/unit/topology/database/test_greenplum.py`, `ingestion/tests/integration/greenplum/test_metadata.py`
- **Related:** #34860, #38131, ADR:2026-11-18-greenplum-distribution-keys-require-the-modern-catalog

## Context

Distribution keys are optional enrichment. Rejecting a table because this lookup failed discards
otherwise available columns and constraints. A failed PostgreSQL statement also leaves the shared
read transaction aborted, so merely catching its exception prevents later metadata queries from succeeding.

## Decision

- Retain the Greenplum 6+ catalog guard and the single, ordered `DIST_KEY` mapping. Older catalogs
  skip extraction; random and replicated tables and views emit no distribution-key constraint.
- Catch SQLAlchemy errors from the distribution-catalog read, roll back the failed read transaction,
  and log a warning identifying the skipped constraint and table.
- Continue shared constraint processing and emit the table without `DIST_KEY`. Other metadata and
  existing constraints remain available, and subsequent tables can use the connection.
- Keep unrelated processing and validation errors outside this exception handler.

## Consequences

A failed lookup omits distribution-key metadata for that run rather than rejecting the table.
The warning distinguishes lookup failure from a table with no distribution key. Rollback adds
recovery work only on failure; successful lookups still use one catalog query per table.
