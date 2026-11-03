# Pipeline status reads and writes are bounded by size, not only by count

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `PipelineStatusReaderTest`, `PipelineResourceIT`
- **Related:** scanner finding ANT-2026-75981HCK (open-metadata/openmetadata-collate#7797)

## Context

`GET /v1/pipelines/{fqn}/status` loaded every stored status between the caller-chosen `startTs` and
`endTs` into memory and applied `limit`, cursors and filters to the list afterward, so no request
parameter bounded what was read. Neither the number of statuses nor the size of one was bounded, and a
parsed status can take tens of times its stored size, so a single small request — even `limit=1` —
could exhaust the default 1 GB heap, and concurrent ones made the server unusable for others. The
bulk write and `calculateAverageRuntime` read ranges the same way.

## Decision

A status range is read a page at a time, and both reads and writes are bounded by JSON size:

- **Page.** A page ends at `limit` or at `MAX_PAGE_JSON_LENGTH` (512 KiB of status JSON), whichever
  comes first, and a page cut short carries `paging.after` to the rest. `limit=0` returns only the
  total; a `before` cursor returns the page adjacent to the cursor, not the newest page.
- **Status cap.** A stored status may be at most `MAX_STATUS_JSON_LENGTH` (1 MiB of JSON); a larger
  write is refused with 400. A single status between the page budget and the cap is returned alone.
- **Legacy rows.** The range read and its `count` exclude, in SQL, any stored row larger than the cap
  (`CHAR_LENGTH` on MySQL, `LENGTH(json::text)` on Postgres), so a status written before the cap is
  never loaded whole; `paging.total` counts only rows a page can return. Such rows can be removed by a
  migration later (a product decision, not done here).
- **Batches.** The reader holds one `READ_BATCH_SIZE` (8-row) batch plus the page it is building, and
  does not parse the row past a full unfiltered page.
- **Bulk writes.** `PUT …/status/bulk` is processed in chunks of `STATUS_WRITE_CHUNK_SIZE` (25) so the
  stored rows loaded to compare against, and the per-status change-event snapshots, stay bounded
  however many statuses the request carries.

The values are chosen so one request's parsed heap (~26× its JSON) stays well under the default 1 GB
even with several requests in flight.

## Consequences

- A page may be shorter than `limit` because of the size budget, and then carries `paging.after`; a
  client that does not follow cursors sees partial data. The UI, the Java SDK and the Python client
  were updated to follow `paging.after`.
- `limit=0` now returns only the total (was: everything); a `before` cursor now returns the adjacent
  page (was: always the newest). Statuses over 1 MiB are rejected (an API change), and a status stored
  over the cap before this change is invisible to the listing until a migration removes it.
- Out of scope: a request-body size limit for a single oversized `PUT …/status` body, and the admin
  `reindexPipelineExecutions` backfill, which is unbounded but admin-only.
