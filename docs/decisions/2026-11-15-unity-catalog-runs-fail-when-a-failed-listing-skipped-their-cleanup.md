# A Unity Catalog run whose failed listing skipped a stale cleanup fails

- **Status:** Accepted
- **Revisions:** v1 2026-11-15 (initial)
- **Deciders:** akashverma0786
- **Guard:** `ingestion/tests/unit/topology/database/test_unitycatalog_error_isolation.py` (`TestStaleCleanupAfterFailedListing`)
- **Related:** ADR:2026-10-22-tableau-runs-stop-without-deleting-while-the-metadata-api-backfills, ADR:2026-10-30-an-empty-seen-set-deletes-the-scope-only-when-the-connector-confirms-its-listing

## Context
The Unity Catalog source lists catalogs, a catalog's schemas and a schema's tables through the
Databricks SDK, and a listing can fail partway: a page raises, a call is denied. The source records
the failure and carries on, and the topology runner then runs the `markDeleted*` cleanups against
the partial listing, so what the listing did not reach was soft-deleted with its tests and lineage.
The server's guard against an empty seen-set does not help once the set holds anything, such as
another catalog's tables. `REVIEW.md` ("Failed or partial discovery never drives deletion") states
the general rule; this record states how Unity Catalog applies it.

## Decision
- A failed listing marks its scope incomplete for the run: the catalogs, one catalog's schemas, or
  one schema's tables. The catalog listing the database cleanup makes itself counts too.
- A `markDeleted*` cleanup skips an incomplete scope.
- When a skipped cleanup was enabled, the run raises `WorkflowFatalError` after the topology,
  whatever `successThreshold` is. A listing failure with every matching `markDeleted*` off stays an
  ordinary recorded failure.
- Not a failed listing: a catalog without the configured `databaseSchema` when no `catalog` is
  configured (it is out of scope), and a failed progress-total count (it only costs the progress
  denominator).

## Consequences
A partial listing never soft-deletes what it did not reach, and the run that skipped the cleanup
cannot pass as a success. A listing that fails on every run, such as `PERMISSION_DENIED` on one
schema, fails every run of the service until it is fixed. The Tableau record leaves recurring
failures out of its rule, because failing on one oversized workbook would block a site for good.
Here the fix is in the user's hands: grant the permission, exclude the scope with a filter pattern
so it is not listed, or turn the matching `markDeleted*` off, which leaves an ordinary recorded
failure. Revisit if a Unity Catalog listing failure turns up that the user cannot clear that way.
