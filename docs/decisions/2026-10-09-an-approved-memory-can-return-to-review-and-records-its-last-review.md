# An Approved memory can return to review, and a memory records when it was last reviewed

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryStatusTransitionTest`, `ContextMemoryLifecycleTest`, `ContextMemoryIT`
- **Related:** PR #34956; ADR:openmetadata-collate/2026-10-09-approved-memories-are-revalidated-a-set-interval-after-their-last-check

## Context

Collate's Memory Reconciliation now revalidates an Approved memory once an interval has passed
since it last changed or was last reviewed. Two things in the lifecycle stood in the way. An
Approved memory could not move to Draft, so a conflict the judge was unsure about — or one between
memories with different audiences — had no route to a person and had to be left Approved. And
nothing on the memory said it had been checked: confirming one either wrote nothing visible or
needed a store of its own beside the entity.

## Decision

1. `Approved` may move to `Draft`. It is the only retired-or-resolved stage that may: Archived,
   Deprecated, Invalidated, Rejected and Superseded still cannot. Draft keeps the reason supplied
   with the move, as it already does from Unprocessed.
2. `lastReviewedAt` records when a memory was last confirmed to hold. Becoming Approved sets it to
   that write's `updatedAt`, whoever approves — a person through the API or reconciliation — unless
   the caller supplies its own value; creating a memory as Approved sets it too. Reconciliation
   sets it when it revalidates an Approved memory and finds it still holds. A PUT keeps the stored
   value, like the other lifecycle fields.
3. A change to `lastReviewedAt` is recorded in version history, so a revalidation is a visible
   version written by the reconciliation bot.

## Consequences

- A revalidation that confirms a memory is an ordinary guarded PATCH: it moves `updatedAt`, adds a
  version, reindexes, and fires the usual change events, at most once per memory per interval.
- Draft is again the one human review queue, for new candidates and for Approved memories alike. A
  memory sent back to Draft stops grounding answers until a person approves or rejects it.
- An Approved memory with no `lastReviewedAt` predates the field; nothing backfills it.
