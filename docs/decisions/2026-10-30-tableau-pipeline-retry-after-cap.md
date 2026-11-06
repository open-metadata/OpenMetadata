# Tableau Pipeline waits out a Retry-After of at most 30 s and fails at once on a longer one

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Akash Verma
- **Guard:** `test_tableaupipeline_client.py::TestNetworkLimits::test_a_long_retry_after_fails_at_once_and_says_why`
- **Related:** open-metadata/OpenMetadata#26500

## Context

Tableau Cloud limits flow calls per site per hour (`api.rest.flows.hourly`). Once the quota is used
up, it answers 429 with a `Retry-After` that counts down to the top of the hour (687 s was
observed). The client retried 429 three times and honoured `Retry-After` with no cap, and urllib3
logs nothing at INFO. A run therefore sat silent for about 10 minutes, or failed Test Connection with
only `[SIGNUM 14] STREAM ioctl timeout`. Tableau documents neither this limit's size nor `Retry-After`.

## Decision

A 429 or 5xx whose `Retry-After` is at most 30 s is retried as before, after that wait. A longer
`Retry-After` is not retried. The client logs a WARNING naming the status, the `Retry-After` and
the cap, and returns the response, so tableauserverclient raises Tableau's own message: "Too many
requests for 'api.rest.flows.hourly'. Please retry after N seconds." The cap stays below what the
180 s Test Connection step can absorb: three waits of 30 s take 90 s, while a cap of 60 s would let a
single call reach the step's alarm, the silent stall this record removes.

## Consequences

Short waits are still retried. Tableau's answers also carry undocumented per-second rate-limit
headers (`x-ratelimit-limit: 1000, 1000;w=1`, `x-ratelimit-reset: 1`), whose throttles would ask for
about a second. A used-up
hourly quota fails each call within seconds and says why, instead of stalling the run. Calls that
fail this way leave their pipelines without fresh status or lineage until a later run. A page of the
flow listing can now fail too, so this ships with the guard that stops a partial flow listing from
marking pipelines deleted. To revisit, the quota would need a documented size, so that a run could
pace itself under it.
