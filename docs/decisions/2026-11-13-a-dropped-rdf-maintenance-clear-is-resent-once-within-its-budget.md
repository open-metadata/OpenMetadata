# A dropped RDF maintenance CLEAR is resent once, within its original budget

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Platform
- **Guard:** `MaintenanceUpdateDroppedConnectionTest`
- **Related:** #37751, ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule

## Context

An in-place RDF reindex starts with `CLEAR ALL`. In CI it runs after minutes of search reindexing
without any RDF traffic, and by then Fuseki has closed the pooled keep-alive connection. The JDK
HttpClient resends only idempotent requests on a stale connection, never a SPARQL update POST.
The clear failed with `EOFException`, the run failed, and `/api/v1/rdf/status` reported the
projection `DEGRADED`. This happened on about half of the Playwright RDF lane runs.

## Decision

`JenaFusekiStorage.executeMaintenanceUpdate` resends a maintenance SPARQL update **at most once**,
and only when the connection closes before Fuseki answers: an `EOFException` or a
`SocketException` (a reset, or a `ConnectException` because Fuseki refused the connection).

- The resend gets only what is left of the original `storageMaintenance.maxDurationMinutes`
  budget. Nothing is resent once the budget is used up, so a clear never holds the write pause
  past the cap.
- A timeout, an HTTP error status or a storage-guard refusal is never resent.

A resend is allowed only because every maintenance update is a `CLEAR`. Sending a `CLEAR` twice
leaves the same result. Serving writes are paused for the whole clear, so no write can land
between the two sends and be erased by the second.

## Consequences

A stale pooled connection no longer fails a reindex. A maintenance update that is not idempotent
must not go through `executeMaintenanceUpdate`. It needs its own path, or this record has to be
revised first. Resending when Fuseki is down costs one extra refused connection before the run
fails as before.
