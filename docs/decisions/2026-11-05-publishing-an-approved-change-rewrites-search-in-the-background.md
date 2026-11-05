# Publishing an approved change rewrites search in the background

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Anuj Kumar Yadav
- **Guard:** `SearchWritesInBackgroundTest`
- **Related:** ADR:2026-10-30-a-glossary-term-move-is-authorized-and-held-as-the-patch-that-makes-it,
  nightly AUT run 41934979088

## Context
A write's cascade search rewrites are captured during its transaction and drained after commit on
the request thread, so search is read-your-write by the time the request returns. Publishing an
approved change (`ChangeApplyService.apply`) runs on the reviewer's resolve request. For a glossary
term move or rename that cascade includes `updateGlossaryTermByFqnPrefix`, a synchronous
update-by-query with `refresh=true` over the global alias. In nightly run 41934979088 the cluster was
busy with inherited-field propagation, and each held-move resolve sat on that one call for 60 s
(once rejected with `429 too many scroll contexts`) while the database work took 0.1 s. The reviewer's
request outlived the client's wait.

## Decision
`ChangeApplyService.apply` runs inside `SearchRepository.withSearchWritesInBackground`: the
rewrites the publish captures are handed to the async executor (`SEARCH_OPERATION`) once the
transaction commits, and dropped if it rolls back. A rewrite that fails, or that the executor
rejects, is enqueued to `SearchIndexRetryQueue` as a drained rewrite is. Every other write keeps
draining inline. Under an already-open deferral scope the outer owner drains, as before.

## Consequences
The resolve returns once the change is stored. Search reflects the published change shortly after,
not by the time the response arrives, so anything reading search after approving a change polls.
Plain PATCH, rename and `moveAsync` writes are unchanged. Revisit if a reviewer flow needs search
read-your-write on the resolve response.
