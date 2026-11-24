# Column bulk update buffers socket messages until its job id is known

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial) · v2 2026-10-16 (evict the oldest progress message, never a terminal one)
- **Deciders:** anuj-kumary
- **Guard:** `ColumnGrid.test.tsx` — "shows the success toast when the job completes before the update request returns" and "keeps an early completion when another job floods the buffer"
- **Related:** #35595, #35596

## Context
`POST /columns/bulk-update-async` submits the job before it returns the `jobId`. A small job can
send STARTED, IN_PROGRESS and COMPLETED on `bulkAssetsChannel` before the UI has the response.
`ColumnGrid` matched messages against a `jobId` it did not have yet and dropped them. The result was
no success toast, no grid refetch, and a flaky `ColumnBulkOperations.spec.ts`.

## Decision
While the POST is in flight, `ColumnGrid` keeps every bulk-assets message in a buffer capped at
`MAX_EARLY_SOCKET_MESSAGES` (100). When the buffer is full, the **oldest** message is evicted, so the
latest message (the terminal COMPLETED/FAILED) is always kept. Once the response arrives and the
grid state is set up, the buffered messages are replayed in arrival order through the normal
handler, which drops those for other jobs. A failed POST discards the buffer.

## Consequences
The UI no longer depends on the HTTP response winning the race against the socket. The server
contract stays the same. 100 is far more than one request's round trip can deliver, and a job that
sends more than 100 progress messages in that window loses only its oldest progress updates. Revisit
if the endpoint starts returning the `jobId` before it starts the job, which would make the buffer
unnecessary.

## Amendment
v2: the channel carries every bulk job of the user, so another job's progress messages can fill
the buffer. When full, the buffer now evicts its oldest **non-terminal** message; a terminal
COMPLETED/FAILED message is evicted only if the buffer holds nothing else.
