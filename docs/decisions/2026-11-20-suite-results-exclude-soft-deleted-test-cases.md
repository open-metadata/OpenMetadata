# Test-suite summaries exclude soft-deleted test cases

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** OpenMetadata contributors (PR #38250)
- **Guard:** TestSuiteResourceIT.softDeletedFailedTestIsExcludedFromSuiteDetailAndSearchList and TestSuiteRepositoryTest.softDeletedFailingCaseDoesNotAffectInMemorySuiteSummary
- **Related:** Issue #38228, PR #38250

## Context

Soft-deleting a test case preserves its stored time-series results for history.
The test suite's latest-result, bulk summary and maximum-timestamp queries used
the test-case relationship and FQN but did not check whether the test case was
soft-deleted. A deleted failing test case therefore continued contributing to
the suite summary and downstream alert/completion processing.

## Decision

- Test-suite result summaries, counts and maximum result timestamps include
  only test cases that are not soft-deleted: `tc.deleted = FALSE OR tc.deleted
  IS NULL`, irrespective of the suite request's `include` value.
- The rule applies identically to MySQL and PostgreSQL, single-suite result
  queries, batched summaries and per-suite maximum-result timestamps.
- In-memory result summaries resolve only currently non-deleted test cases.
- Soft deletion preserves `data_quality_data_time_series` history for audit.
  Restoring a test case makes its persisted results visible again without
  requiring new ingestion or duplicating historical rows.

## Consequences

Existing persisted history remains untouched. Current suite summaries and
completion alerts no longer report deleted tests as active failures. Database-
backed MySQL/PostgreSQL tests covering mixed live/deleted results, both summary
APIs and timestamps are required before merge. The existing Java summary
regression checks non-deleted result filtering but is not a substitute for a
live DAO integration test.
