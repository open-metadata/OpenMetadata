# A failed Unity Catalog listing skips its stale cleanup without failing the run

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** akashverma0786
- **Guard:** `ingestion/tests/unit/topology/database/test_unitycatalog_error_isolation.py` (`TestStaleCleanupAfterFailedListing`)
- **Related:** [#37112](https://github.com/open-metadata/OpenMetadata/pull/37112) (option 2 of the upgrade-impact review), ADR:2026-10-22-tableau-runs-stop-without-deleting-while-the-metadata-api-backfills, ADR:2026-10-30-an-empty-seen-set-deletes-the-scope-only-when-the-connector-confirms-its-listing

## Context
The Unity Catalog source lists catalogs, a catalog's schemas and a schema's tables through the
Databricks SDK, and a listing can fail partway: a page raises, a call is denied. The source recorded
the failure and carried on, and the topology runner then ran the `markDeleted*` cleanups against the
partial listing, so what the listing did not reach was soft-deleted with its tests and lineage. The
server's guard against an empty seen-set does not help once the set holds anything, such as another
schema's tables. `markDeletedTables` is on by default, so this reached almost every service.

`REVIEW.md` ("Failed or partial discovery never drives deletion") also asks such a run to fail
whatever `successThreshold` is. Unity Catalog listing failures are often the same on every run, such
as `PERMISSION_DENIED` on one schema; failing the run for them would turn every run of that service
red until the grant changes, which is the case the Tableau record leaves out of its own rule.

## Decision
- A failed listing marks its scope incomplete for the run: the catalogs, one catalog's schemas, or
  one schema's tables. The listings the cleanups make themselves count too.
- A `markDeleted*` cleanup skips an incomplete scope, so nothing the listing did not reach is
  marked as deleted. Scopes whose listings succeeded are cleaned as usual in the same run.
- The listing failure is recorded once, as an ordinary failure that counts against
  `successThreshold`. Its message says nothing it did not reach was deleted, and that a failure
  repeating on every run is cleared by granting access or excluding the scope with a filter pattern.
  The run does not raise `WorkflowFatalError`, and the skipped cleanup adds no second failure.
- Not a failed listing: a catalog without the configured `databaseSchema` when no `catalog` is
  configured (it is out of scope), and a failed progress-total count (it only costs the progress
  denominator).

## Consequences
A partial listing never soft-deletes what it did not reach, and a failure that repeats on every
run shows as a partial success instead of blocking the service. A run with many failed scopes still
falls below `successThreshold` and fails. Stale entities in a failing scope stay until a run lists
it completely. The success rate is rounded to two decimals, so a run with about 20,000 or more
records per failure reports 100 % and its listing failure is visible only in the failure list; that
rounding is workflow-wide and not changed here. Revisit if the rounding is fixed, or if a Unity
Catalog listing failure turns up that a user cannot clear with a grant or a filter.
