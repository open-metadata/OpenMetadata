# Fast-mode Playwright setup pulls the fixture images before, and outside, the 5-minute startup budget

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#36404, open-metadata/OpenMetadata#36509,
  `.github/actions/setup-openmetadata-test-environment/action.yml`,
  ADR:2026-10-28-playwright-golden-fixtures-are-scoped-to-their-seed-database

## Context

The `Restore fast Playwright environment` step runs under a 5-minute `timeout`, which is meant to
bound restoring the fixture and starting the stack. It also covered pulling the database and search
images. On the first MySQL runs, about 40 shards pulled Elasticsearch from `docker.elastic.co` at
once and each pull took 4–5 minutes, so shards timed out before the server started, with no test
run.

## Decision

- A separate `Pull fast Playwright environment images` step runs first, under a 15-minute
  `timeout`. It pulls the `databaseImage` and `searchImage` recorded in the fixture manifest.
- Registry pull time is never counted against the 5-minute restore and startup budget.
- The pull step fails if the manifest cannot be read or lacks either image, rather than skipping
  the pull and leaving the restore step to fail inside its budget.

## Consequences

- A slow registry costs time, not a failed shard; the startup budget still catches a stack that
  does not come up.
- A shard can spend up to 20 minutes in setup before tests start. A pull that keeps exceeding
  15 minutes points to a registry or mirror problem, not a reason to raise the budget.
- Folding the pull back into the restore step, or trimming the 15 minutes, would bring back the
  timeouts above; either needs this record amended.
