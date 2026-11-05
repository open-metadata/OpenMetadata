# The Alation Sink writes in batches of 1000 and waits for each Alation job to finish

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** ingestion
- **Guard:** `ingestion/tests/unit/source/metadata/alationsink/test_client.py`
- **Related:** #25420

## Context
Alation's relational integration APIs (`/integration/v2/{schema,table,column}/`) answer a write
with `{"job_id": n}` and do the work in a background job, read from
`/api/v1/bulk_metadata/job/?id=n` (`running`, `successful` or `failed`). A `successful` job can
still reject some objects, listed under each result's `errors`. The sink treated the job id as
success, so rejected objects went unreported, and it posted every schema, table or column of a
parent in one request, however many there were. Alation's own SDK (Allie-SDK) batches every async
POST at 1000 and waits for each job; Alation's docs state differing per-endpoint limits.

## Decision
- Schema, table and column writes go out in batches of `WRITE_BATCH_SIZE` = 1000, the SDK default,
  which sits at or under every limit the docs state.
- Each batch's job is polled, starting at 0.5 s and backing off to 5 s, until it finishes. A job
  still running after `JOB_TIMEOUT_SECONDS` = 600 is a failure, not a success. The deadline is
  checked before every poll and no sleep runs past it; each poll has a 30 s read timeout
  (`JOB_POLL_REQUEST_TIMEOUT_SECONDS`) and no retries, so a wait overruns the deadline by at most
  one poll. A transient poll failure (transport, 429, 5xx) is retried by the next poll, since the
  job may still succeed; any other poll failure fails the batch at once rather than repeating
  until the deadline.
- A `failed` job, and every per-object error of a `successful` one, is logged in full; the run
  status records at most the first `MAX_REPORTED_ERRORS` = 5 of them per parent, plus a count of
  the rest, so one bad table does not flood the run report.
- Parents are written before their children and each write waits for its job, so a column write
  never races the job creating its table.

## Consequences
A run takes longer by the time Alation spends on each job, since writes are now sequential and
awaited. Revisit the batch size if Alation publishes a single documented limit, and the timeout if
a large instance legitimately runs jobs longer than ten minutes.
