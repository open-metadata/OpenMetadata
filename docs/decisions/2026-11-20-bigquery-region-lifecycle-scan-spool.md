# BigQuery lifecycle: bounded region-scan spool and retry policy

Date: 2026-11-20
Status: Proposed (PR #38244; issue #38207)

## Context

BigQuery's region-qualified `INFORMATION_SCHEMA.TABLES` and
`INFORMATION_SCHEMA.TABLE_STORAGE` views can bill for a whole region even when
the SQL filters on one dataset. A dataset-specific query repeated across many
datasets, or reexecuted by an interleaved one-entry lifecycle cache, multiplies
the charge. Keeping the entire region in an unbounded Python dictionary is not
safe for large catalogs either.

## Decision

- Execute the region-wide lifecycle query **once per project/region per run**
  after a successful scan, retaining the dataset key so identical table names
  in different datasets cannot collide.
- Stream the result into a temporary, disk-backed SQLite spool in batches of
  100 rows. Cap SQLite's main database at **256 MiB** (4 KiB pages x 65,536
  pages) rather than retaining every project/region's table data in RAM.
  Only the requested dataset's rows are materialized into Python objects.
  Remove the temporary database when the source closes.
- Coordinate same-project/region workers with a per-key lock that exists only
  while requests are active. Different regions may scan concurrently. Protect
  short SQLite operations with a separate shared lock.
- Skip and warn about malformed rows individually. An invalid row must not
  invalidate the lifecycle timestamps of other tables or datasets.
- Roll back an incomplete scan by removing only its project/region's records.
  Retry a **transient** region-query failure once on a later dataset (at most
  two attempts per project/region). Do **not** retry deterministic failures:
  SQLite cache capacity/IO errors or upstream non-retryable 4xx errors
  (excluding 429).
- Only failures originating from local SQLite/tempfile operations disable
  the region spool for the remainder of the ingestion run, using one in-memory
  boolean before attempting cleanup. Local failures carry a dedicated error
  type; network/transport `OSError` from BigQuery is handled by the regional
  retry budget instead and must not disable other regions.
  Disk-full errors can also prevent DELETE, rollback, or writing a "failed"
  status to SQLite; none of those operations may be required to block another
  billed region scan. Already-committed partial records remain inaccessible
  while disabled and are removed with the temporary directory on close.
- If the region query cannot complete within these limits, use the
  dataset-qualified created-only `INFORMATION_SCHEMA.TABLES` query. This
  avoids repeating costly region scans but cannot supply `updated_at` until a
  subsequent ingestion run.
- Keep unknown-region, custom-query, and sharded-table paths unchanged.

## Consequences

Successful region scans reduce BigQuery billing and retain both `created_at`
and `updated_at`. The spool trades local temporary disk space and SQLite
writes for bounded ingestion memory. Large regions that exceed the local
capacity, permanent permission failures, and repeated transient failures
degrade explicitly to created-only metadata. Region scans are not globally
serialized, but short spool writes share a lock.

## Verification

The PR adds focused tests for multi-dataset scope, concurrent reuse, parallel
regions, bounded disk cleanup, invalid rows, transient recovery, and permanent
failure behavior. Live BigQuery billing, the repository's full ingestion suite
and CI require separate verification.
