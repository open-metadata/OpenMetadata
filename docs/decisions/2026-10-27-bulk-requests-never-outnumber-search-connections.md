# Bulk requests never outnumber the search client's connections

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `OpenSearchBulkProcessorConnectionPoolTest` and `ElasticSearchBulkProcessorConnectionPoolTest`
  run the real HC5 clients against a slow fake node and fail when a bulk waits for a pooled
  connection or an open circuit drops a bulk; `BulkConnectionBudgetTest` pins the reserve arithmetic
- **Related:** #36351, PR #31659 (`connectionRequestTimeoutSecs`), PR #27698 (leaked-future guard on the bulk semaphore)

## Context
Reindex bulk sinks send through the server's shared search client. Its HC5 pool defaults to
`maxConnPerRoute=10` / `maxConnTotal=30` (OSS main ships 50/100), and since PR #31659 a request waits
at most `connectionRequestTimeoutSecs` (5 s) for a pooled connection. `maxConcurrentRequests` (30–100,
Auto Tune up to 200) was never related to the pool. When the cluster slowed down, the bulks above the
pool's size queued inside it and failed with `DeadlineTimeoutException`: a lease timeout raised by
our own client, not a cluster error. Five of those in 30 s opened the bulk circuit breaker. It then
dropped every batch for 10 s, half-opened for all the queued bulks at once, and opened again.
Query-heavy reindexes, with millions of query entities, failed this way intermittently on several
clusters, and a rerun usually passed. Reproduced against the pinned HttpClient 5 with 30 bulks in
flight on 10 connections: 0% of bulks failed at 2 s per bulk and 33% at 3 s. Concurrency above the
pool size added failures, not throughput.

## Decision
- Every bulk processor (reindex, live indexing, the retry worker, column indexing) holds a permit
  from its search client's `BulkConnectionBudget` while a request is outstanding. Permits are the pool
  capacity minus a search reserve of max(2, 20% of capacity), and never fewer than 1. Capacity is
  min(`maxConnTotal`, `maxConnPerRoute`) for the HC5 transports, using HC5's defaults when a limit is
  unset, and the AWS SDK's `MAX_CONNECTIONS` (50) for the IAM transport. It is one host's worth even
  with several hosts configured: the transport sends to the hosts that are up and limits each one
  separately, so a budget summed over hosts would let bulks queue on the survivors when one goes down.
- `maxConcurrentRequests` and Auto Tune stay per-sink ceilings; the budget is the server-wide one.
- A flush waiting for permits fails its batch only after no bulk attempt has completed for a stall
  window (the leaked-future case), never merely because bulks are slow. The window is 60 s plus the
  bulk lifetime below, because a bulk parked in a retry backoff or behind an open circuit completes no
  attempt for up to that long.
- The bulk circuit breaker ignores pool-wait timeouts and counts each bulk once: its first attempt,
  or its probe. When half-open it admits one probe at a time, claimed with a single compare-and-set,
  and a probe silent for three probe intervals is replaced. Bulks the open circuit rejects are
  paused instead of failed.
- Each bulk gets a deadline 120 s after its first send, and its retries and pauses carry it. A retry
  whose backoff would end after the deadline is not scheduled, and a paused bulk fails when the
  deadline passes. A bulk is therefore written or recorded as failed within 120 s, plus at most
  one in-flight attempt. That is below the roughly 3 minutes after which a PartitionWorker
  reconciles sink operations that are still pending, whatever backoff is configured.
- Reindex sinks retry with the app's Max Retries / Initial Backoff / Max Backoff, within the
  deadline. Other sinks keep 3 retries starting at 100 ms.

## Consequences
A slow cluster slows the reindex instead of failing it: producers block on permits. User searches
keep at least the reserve while a reindex runs. Reindex throughput is bounded by the pool, so raise
`maxConnPerRoute`/`maxConnTotal` (`ELASTICSEARCH_MAX_CONN_PER_ROUTE`/`ELASTICSEARCH_MAX_CONN_TOTAL`)
to go faster. Raising `connectionRequestTimeoutSecs` is not a fix, because it lets user searches hang.
A cluster that stays unreachable for more than a bulk's 120 s deadline still fails the run, and
backoff settings longer than the deadline are cut short by it. Revisit if bulk
writes move to a dedicated client or pool; the budget should then be sized from that pool.
