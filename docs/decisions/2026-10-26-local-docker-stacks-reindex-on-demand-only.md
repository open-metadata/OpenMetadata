# Stacks started by run_local_docker reindex on demand only

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `seedLineageAndSharedInfra` (`playwright/e2e/lineage-data.helper.ts`) fails the
  Playwright fixture build when the lineage API is missing any seeded entity below the root
- **Related:** Postgres Playwright nightlies 40155676742 and 40261121182 (LineageFilters); the Playwright boot cache (`support/fixtures/serverLoad.ts`) dropped every setting a spec writes in the same change

## Context
The seeded `SearchIndexingApplication` carries a weekly recreate-reindex cron (Sunday 00:30 UTC). A
recreate-reindex rebuilds each index from a database read and swaps it in, so documents written
while it runs lose those writes. The Playwright CI fixture is a raw copy of a stack started by
`docker/run_local_docker.sh`, and the scheduled cache build seeds at about :30 past the hour. On
2026-10-25 the cron fired mid-seed. The fixture was cached with all 14 lineage edges in Postgres
but six missing from search, and every shard restored it until the cache was gone. The Playwright
setup already disabled the schedule, but its PATCH landed 21 seconds after the run had started.

## Decision
`run_local_docker_common.sh` sets the `SearchIndexingApplication` schedule to `None` as soon as
the server responds, before sample data, and reindexes only through its explicit trigger, which it
waits out before the Playwright seed runs. The PATCH does not stop a run that already started: it
deletes the scheduled job, so the trigger's already-running check no longer sees that run. Such a
run can only start in the seconds between the server coming up and the PATCH, and sample data takes
minutes, so it ends long before the seed. The Guard is what catches it if it does not.

## Consequences
Local stacks started with the script no longer reindex weekly; reindex from the Applications page
or the trigger API when needed. A reindex that still overlaps the seed now fails the fixture build
at the Guard instead of producing a silently incomplete fixture. To revisit, the fixture would need
a reindex-safe way to write during a rebuild, such as a reindex that replays writes made while it
ran.
