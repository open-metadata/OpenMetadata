# Memory content recency and usage are independent of review writes

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryWriteAccessIT` (content-clock and concurrent-usage cases on both databases)
- **Related:** open-metadata/OpenMetadata#35011, open-metadata/openmetadata-collate#7247;
  ADR:2026-10-09-an-approved-memory-can-return-to-review-and-records-its-last-review;
  ADR:openmetadata-collate/2026-10-09-approved-memories-are-revalidated-a-set-interval-after-their-last-check

## Context

A review PATCH changes `updatedAt`, even when the claim is unchanged. Using that audit timestamp
for knowledge recency makes an old confirmation outrank its correction, displaces recent
references and repeatedly judges unchanged pairs. Retrieval concurrently records usage without
bumping a version, so replacing the whole JSON document during a lifecycle write can lose a
usage increment even when its optimistic guard succeeds.

## Decision

`lastContentUpdatedAt` is optional in the wire schema and owned by the repository. Creation sets
it to the creation timestamp. Title, description, summary, question, answer, machine representation,
memory type, scope or primary subject changes advance it. Reviews, stage transitions, pins, tags,
sharing and telemetry preserve it. The updater compares the latest snapshot before in-session
consolidation, so a later pin cannot replay an earlier content edit as new knowledge.

Legacy rows use `updatedAt` until their next write; that write persists the old timestamp before
advancing the audit timestamp. No structural SQL migration or eager backfill is required for this
optional JSON field. Clients can continue omitting it. Collate uses content time for group ordering
and preference freshness, and the separate review clock acknowledges a human's existing decision.

Retrieval increments only `usageCount` and the monotonic `lastUsedAt` atomically in the database.
Guarded and ordinary memory metadata writes preserve those fields from the current row rather
than a pre-read snapshot. Both MySQL and Postgres use the same row lock for these writes, so either
ordering of a lifecycle update and a usage increment retains both changes. Usage does not change
the version or either content/audit timestamp.

An update may retain an unchanged, already-stored primary subject after its deletion, allowing a
privileged lifecycle writer to expire the memory. Creation and changing the subject still require
a live reference; the writer and reference visibility checks run first.

## Consequences

`updatedAt` remains the audit clock and all lifecycle changes retain normal guarded history.
Content ordering cannot be changed by bookkeeping or a client-supplied content timestamp. The
legacy fallback is conservative: an old row's most recent audit write is its baseline until it
is first updated by this version. Usage fields are server telemetry and metadata writes cannot
reset them; an explicit telemetry-reset operation would need its own atomic contract.
