# A bulk item the cluster had no capacity for is re-sent, not recorded as a failed document

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `itemsRejectedForIndexingCapacityAreReSentInsteadOfRecordedAsFailed`, `itemsStillRejectedWhenTheRetryBudgetRunsOutAreRecordedAsFailed` and `closingWhileItemsAwaitAReSendCountsEachDocumentOnce` in `OpenSearchBulkProcessorConnectionPoolTest` and `ElasticSearchBulkProcessorConnectionPoolTest` drive the real clients against a node that answers 200 with per-item 429s; `BulkRetryPolicyTest` pins which item errors count as capacity
- **Related:** [ADR:2026-10-27-bulk-requests-never-outnumber-search-connections](2026-10-27-bulk-requests-never-outnumber-search-connections.md)

## Context

A bulk request has two ways to be turned away. The whole request can fail — a 429, a dropped
connection, a timeout — and the sinks already re-send those under `BulkRetryPolicy`. Or the request
can succeed, HTTP 200, and individual items carry their own error. The second kind arrives when a
node runs out of indexing-pressure budget:

```
rejected execution of primary operation [coordinating_and_primary_bytes=170375573,
replica_bytes=335672130, all_bytes=506047703, primary_operation_bytes=11466,
max_coordinating_and_primary_bytes=429496729]
```

`handlePartialFailure` treated every per-item error alike: counted as a failed document, reported
through the failure callback, dropped. So a reindex against a busy cluster ended with failures that
no rerun would reproduce and no change to the data would fix, for documents the cluster had simply
asked us to send again. The whole-request path, with the same message, retried.

## Decision

Split per-item errors by whether the cluster was out of capacity. An item is a capacity rejection
when its status is 429 or 503, or its reason names `es_rejected_execution_exception`,
`rejected_execution_exception`, `circuit_breaking_exception` or `too_many_requests`. Those items are
collected and re-sent as the next attempt of the same bulk, under the same retry budget, the same
exponential backoff and — the point of the earlier ADR — the same deadline fixed when the bulk was
flushed. Everything else keeps today's behaviour: a mapping conflict, a version conflict or a
missing document is a property of the document and is recorded as a failure on the first answer.

A bulk whose items are re-sent keeps its processor slot until that send settles, so producers back
off behind it, and it releases its connection in between, so other writers keep sending.

The re-send is a bulk in its own right, carrying only the rejected items. That matters when the
processor has already shut down: the refused schedule records the items of the attempt it was given
as failed, so handing it the subset fails only the items still owed a send, and not the items of the
original bulk that the cluster wrote. The outcome of everything the cluster did settle is recorded
before the re-send is scheduled, so no item is counted twice on that path.

## Consequences

Documents are no longer dropped because a node was briefly full, and a run's failure count stops
depending on how loaded the cluster was. A cluster that stays full costs a bulk its retries and the
items are then recorded as failed as before, so a run still ends.

Re-sending only the rejected subset means later attempts are smaller than the first, which is the
behaviour wanted under pressure. The sinks report the deferred items separately from failures while
a re-send is outstanding, so progress logs stay readable.

Per-item rejections arrive as HTTP 200 and so do not count towards the bulk circuit breaker, which
is unchanged: the breaker exists for a cluster that cannot answer, not for one answering that it is
busy.
