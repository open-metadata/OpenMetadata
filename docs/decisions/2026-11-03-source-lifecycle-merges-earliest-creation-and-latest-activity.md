# Source lifecycle observations retain earliest creation and latest activity

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `LifeCycleMergeIT`, `TableShardingIT`, `LifeCyclesTest`
- **Related:** #36867; ADR:2026-10-29-lifecycle-timestamps-before-the-epoch-are-dropped-on-write

## Context

Source observations can arrive out of order or omit timestamps. A shard family's current
representative can also be newer than the family's earliest known member. Keeping the newest
creation timestamp loses source history. This is a shared lifecycle merge problem, not a reason
to special-case sharded tables in the backend.

## Decision

For every entity type supporting `lifeCycle`, `EntityRepository.EntityUpdater.updateLifeCycle`
merges stored and incoming observations as follows:

- `created` retains the minimum known timestamp.
- `updated` and `accessed` retain the maximum known timestamp.
- A missing incoming aspect preserves its stored value when merging lifecycle objects.
- The selected aspect retains its associated attribution as well as its timestamp.

An ordinary PUT that omits the whole lifecycle preserves the stored object. These merge rules do
not redefine explicit PATCH removal of the whole lifecycle. Existing pre-epoch sanitization
continues to apply before merging.

For example, stored creation `2000` followed by observations `1000`, `5000` and a missing aspect
retains `1000`. Stored update `3000` followed by `4000`, `2500` and a missing aspect retains `4000`.
The same rules apply to ordinary assets and logical shard families. Catalog identity, `createdAt`
and `createdBy` are independent of these source timestamps and remain unchanged.

## Consequences

Late or incomplete observations cannot move known creation forward or known activity backward.
If a source object is dropped and recreated under the same catalog identity, its earliest known
creation remains; this merge rule does not detect a new physical incarnation. A distinct history
requires a distinct catalog identity or an explicit lifecycle reset. No Sharded-only backend
exception is introduced.
