# Service lists isolate broken connections while single-service operations remain strict

- **Status:** Accepted
- **Revisions:** v1 2026-10-17 (initial)
- **Deciders:** Vamsi-klu
- **Guard:** `ServiceEntityResourceTest` and `ServiceConnectionResilienceIT`
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/31887,
  https://github.com/open-metadata/OpenMetadata/pull/35681

## Context

A stored connection that cannot be decrypted or validated must not hide healthy services in the
same list. The broken service must remain discoverable so its configuration can be repaired.

## Decision

Service list endpoints catch `InvalidServiceConnectionException` for each entry and return that
service with `connection` null. The response keeps its identities, order, pagination and
permissions. The fallback logs only the service category and UUID and does not persist the change.

Single-service GET by ID or name and writes retain their existing strict error behavior, including
HTTP 400 for invalid connections. Other exceptions continue to fail the list.

## Consequences

One broken connection no longer prevents listing healthy services. A null connection in a list
does not distinguish an invalid stored connection from other reasons it may be absent; callers
must not treat it as proof that no connection was configured. Single-service reads retain the
error needed to diagnose the broken configuration, and repair requires an explicit write.
