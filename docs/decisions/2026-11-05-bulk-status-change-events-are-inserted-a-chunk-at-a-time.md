# Bulk status change events are inserted a chunk at a time

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `PipelineBulkStatusChangeEventsTest`
- **Related:** #32181 (one change event per written status)

## Context
`PUT /v1/pipelines/{fqn}/status/bulk` emits one change event per status it writes, so alerts see
each run. Every event embeds the whole pipeline, and the endpoint built all of them, up to 1,000,
before inserting the first; the chunks of 100 applied only to the INSERT. A request therefore held
the pipeline's size times the number of statuses, and a pipeline's description has no size limit.

## Decision
- The events are built after the statuses are written, oldest first, and inserted in chunks that
  close at 100 events or at `PipelineRepository.MAX_CHANGE_EVENT_CHUNK_CHARS` (8 MiB) of JSON,
  whichever comes first. Each chunk is inserted before the next event is built.
- The events' content and order are unchanged.

## Consequences
- A request holds at most one chunk of events: 100 small ones, or as many large ones as fit in
  8 MiB plus the one that crosses it.
- Events under about 80 KB still go out 100 to a statement; larger ones go out fewer at a time.
- This bounds the memory a request holds, not its work: it still copies and serializes the
  pipeline once per written status, and stores each copy in `change_event`.
