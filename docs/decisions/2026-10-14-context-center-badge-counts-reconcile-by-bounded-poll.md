# Context Center badge counts reconcile a 202 async delete by bounded poll

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** @Rohit0301
- **Guard:** `openmetadata-ui/src/main/resources/ui/src/utils/ContextCenterQueryKeys.test.ts` —
  eight cases pin the optimistic drop, the early exit, the retry budget, the timeout behaviour and
  the concurrent-delete arithmetic (including a server that applies only some of several
  concurrent deletes)
- **Related:** #35446

## Context

A drive file's hard delete answers **202 Accepted** and removes the row on a background thread
(`ContextFileResource.delete` → `deleteByIdAsync`). `ContextCenterArchivePage` invalidated the
archive-count query the instant that request resolved, so the refetch raced the background
deletion. When the refetch won, React Query cached the pre-delete total and nothing invalidated
the key again (`staleTime: 0`, but no further trigger exists), leaving the sidebar badge one too
high until a page reload.

The backend does emit a completion signal on `DELETE_ENTITY_CHANNEL`, but today it is consumed
only by `NavBar` → `AsyncDeleteProvider`, which does not drive this page's query keys. Wiring a
new socket subscription into the Archive page would mean a payload-to-query-key mapping and
teardown handling for a single call site — the only caller that passes `hardDelete=true`.

## Decision

`reconcileCountAfterAsyncDelete` drops the count optimistically, then polls
**`attempts = 5` × `intervalMs = 1000` (~5s)** until the server agrees, and keeps the corrected
figure if it never does.

Three choices inside that are easy to undo by accident:

- **`refetchQueries`, not `invalidateQueries`.** Invalidation only marks an *inactive* query stale
  without fetching it, so the reconcile would silently no-op whenever the sidebar observing the
  key is unmounted — the exact staleness this exists to prevent.
- **The budget is sized against the backend, not a happy path.** An earlier ~2s window (5 × 400ms)
  let a parallel Playwright run slip past it and leave the badge stale for good. Early exit means
  a fast delete still settles on the first poll, so the ceiling costs nothing when unneeded.
- **The target is absolute, and the server's figure is clamped to it.** Per key the reconcile
  holds `{ baseline, started }` — the count before the first concurrent delete, and how many have
  been accepted since — so the target is `baseline - started` and each write is
  `min(serverTotal, target)`. Subtracting the in-flight count from whatever the server last
  reported looks equivalent but is not: it assumes *none* of those deletions has landed, so once
  one has it is counted twice and the badge ends up one too **low** — the same permanent staleness
  in the other direction. Clamping lets an already-applied deletion simply not count again.

## Consequences

If the background delete outlives the budget the badge keeps the corrected figure, which is right
whenever the accepted deletion eventually lands and wrong only if it fails outright — a case that
already had no UI signal.

Switch to the `DELETE_ENTITY_CHANNEL` socket event once a second Context Center surface needs the
same polling; at that point the subscription cost is amortised and the budget stops being a guess.
