# The Playwright golden fixture is snapshotted only once search indexing is confirmed idle

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** anuj-kumary
- **Guard:** `wait_for_reindex_idle` in `.github/scripts/create_playwright_fixture.sh`
- **Related:** #36196

## Context
The golden fixture is a copy of the Postgres and OpenSearch data directories, cached under a key
that excludes the commit SHA, so one bad snapshot is restored by every Playwright run until the
cache is deleted. On Sunday 2026-10-25 the `SearchIndexingApplication` default cron
(`30 0 * * 0`) fired during the 00:00 UTC populate run, and the fixture captured half-built
`*_rebuild_*` indices. Every merge-queue and nightly run then failed on sample-data search
assertions.

The app run record cannot tell a running reindex from a finished one: `ACTIVE_ERROR` is written
both mid-run (error threshold hit) and as the final "completed with errors" status, and
`fillTerminalTimings` stamps `endTime` on it in both cases.

## Decision
Before stopping the containers, the fixture script polls `GET /api/v1/search/stats` and snapshots
only when `isSearchIndexingRunning` is exactly `false`; that flag reads the live Quartz scheduler
and the distributed-job table. Any other answer (`true`, missing, HTTP error, timeout) keeps
waiting. After `FIXTURE_REINDEX_WAIT_SECONDS` (default 900s, about 15x a full sample-data reindex
in CI) the step fails, so the cache save is skipped and the next 6-hourly populate run retries.

## Consequences
A broken stats endpoint or auth token fails fixture creation instead of silently caching a
partial index; runs then build their own fixture until it is fixed. Other scheduled apps are not
covered; extend the check if one of them starts mutating indices the fixture depends on.
