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

`reconcileCountAfterAsyncDelete` polls the **deleted entity's own absence** —
`getContextFileById` until it stops resolving — for **`attempts = 5` × `intervalMs = 1000`
(~5s)**, then refetches the count once and keeps whatever the server reports.

Three choices inside that are easy to undo by accident:

- **`refetchQueries`, not `invalidateQueries`.** Invalidation only marks an *inactive* query stale
  without fetching it, so the reconcile would silently no-op whenever the sidebar observing the
  key is unmounted — the exact staleness this exists to prevent.
- **The budget is sized against the backend, not a happy path.** An earlier ~2s window (5 × 400ms)
  let a parallel Playwright run slip past it and leave the badge stale for good. Early exit means
  a fast delete still settles on the first poll, so the ceiling costs nothing when unneeded.
- **The completion signal is the row's absence, never a precomputed count.** An earlier version
  targeted `baseline - started` — the count cached when the first delete started, minus the
  deletes accepted since. Anything else moving the archive count inside the window skewed it, and
  this page's own restore handler invalidates that very key: a restore mid-window let the poll
  meet its target early and exit, pinning the badge one too **high** once the background delete
  landed. A soft-delete in the window broke it the other way, with the clamp holding the badge one
  too **low**. Asking whether *this* row is gone cannot be confused by a concurrent change, and
  leaving the final number to the server removes the baseline bookkeeping and the clamp entirely.

## Consequences

If the background delete outlives the budget the badge takes the server's current figure, which is
simply the count before that deletion lands. It is a transient over-count rather than the permanent
staleness this fixes: the key is refetched by any later create, delete or restore on the page.

Switch to the `DELETE_ENTITY_CHANNEL` socket event once a second Context Center surface needs the
same polling; at that point the subscription cost is amortised and the budget stops being a guess.
