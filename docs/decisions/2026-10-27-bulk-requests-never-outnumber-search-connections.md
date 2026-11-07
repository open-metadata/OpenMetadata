# Bulk requests never outnumber the search client's connections

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial); v2 2026-10-30 (clarify "counts each bulk once" so a
  pool-wait first attempt can no longer hide the real cluster error on a retry)
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
- Every bulk processor (reindex, live indexing, the retry worker, column indexing) holds a
  connection permit from its search client's `BulkConnectionBudget` while a request is on the wire,
  and a slot in its own processor from flush until the bulk is written or fails. A bulk waiting out a
  retry backoff or an open circuit holds only its slot, so it never keeps another writer on the
  server from sending, live indexing included.
- Permits are the pool capacity minus a search reserve of max(2, 20% of capacity), and never fewer
  than 1. Capacity is min(`maxConnTotal`, `maxConnPerRoute`) for the HC5 transports, using HC5's
  defaults when a limit is unset, and the AWS SDK's `MAX_CONNECTIONS` (50) for the IAM transport. It
  is one host's worth even with several hosts configured: the transport sends to the hosts that are
  up and limits each one separately, so a budget summed over hosts would let bulks queue on the
  survivors when one goes down.
- `maxConcurrentRequests` and Auto Tune stay per-sink ceilings; the budget is the server-wide one.
- Each bulk gets a deadline when it is flushed: 120 s for a reindex, and 10 s for live writes
  (`BulkRetryPolicy.LIVE`), which run on the request thread and fall back to the search retry queue.
  Waiting for a slot or a connection, every retry, and every pause behind an open circuit must fit
  inside it. A retry whose backoff would end after the deadline is not scheduled, and a paused bulk
  fails when it passes. A reindex bulk is therefore written or recorded as failed within 120 s plus
  at most one in-flight attempt. That is below the roughly 3 minutes after which a PartitionWorker
  reconciles sink operations that are still pending, whatever backoff is configured.
- The bulk circuit breaker ignores pool-wait timeouts and counts each bulk once: its first attempt
  that reaches the cluster — a pool-wait attempt never counts, so a real cluster error on a retry
  after one is still that bulk's one verdict, not zero — or its probe. The "once" memory is carried
  per bulk (clear while it has only seen pool-waits, set once the breaker has counted it). When
  half-open it admits one probe at a time, claimed with a single compare-and-set, and a probe silent
  for three probe intervals is replaced. A bulk asks the breaker only once it holds a connection, so
  a claimed probe never waits for one. Bulks the open circuit rejects give their connection back and
  are paused instead of failed.
- Live sinks build their documents on their own pool. A reindex that is out of slots blocks its
  doc-build tasks inside the reindex pool, which a reindex job resizes, and live writes queued
  behind them would hold their request threads.
- Reindex sinks retry with the app's Max Retries / Initial Backoff / Max Backoff, within the
  deadline. Live sinks keep 3 retries starting at 100 ms.

## Consequences
A slow cluster slows the reindex instead of failing it: producers block on their processor's slots.
User searches keep at least the reserve while a reindex runs, and a live write either reaches the
cluster or goes to the retry queue within 10 s, even while a reindex waits out an open circuit.
Reindex throughput is bounded by the pool, so raise `maxConnPerRoute`/`maxConnTotal`
(`ELASTICSEARCH_MAX_CONN_PER_ROUTE`/`ELASTICSEARCH_MAX_CONN_TOTAL`) to go faster. Raising
`connectionRequestTimeoutSecs` is not a fix, because it lets user searches hang. A cluster that
stays unreachable for more than a bulk's deadline still fails the run, and backoff settings longer
than the deadline are cut short by it. Revisit if bulk writes move to a dedicated client or pool;
the budget should then be sized from that pool.
