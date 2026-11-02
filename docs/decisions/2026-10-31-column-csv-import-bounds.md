# A column CSV import walks the catalog once per request, and a synchronous write import is capped at 200 column-occurrence updates

- **Status:** Accepted
- **Revisions:** v1 2026-10-31 (initial)
- **Deciders:** harshach
- **Guard:** `ColumnRepositoryImportTest` (single-walk, payload caps, sync update cap) and `ColumnCsvImportIT` (endpoint statuses)
- **Related:** ANT-2026-37SQZWEA (CWE-770 authenticated DoS via `/api/v1/columns/import`)

## Context

`POST /api/v1/columns/import` resolved every CSV row with its own `searchColumns` call, and each
call loaded every table and dashboard data model from the database. The endpoint had no row or
byte cap, so any authenticated user held a request thread for `rows × catalog size` with a
few-kilobyte body; 64 concurrent imports filled the QoS admission limit and made the REST API
answer 503 to everyone. The write mode (`dryRun=false`) added a second cost, `rows × occurrences
of the named column`, with the same small body.

## Decision

- One import performs exactly one catalog walk; rows resolve against its in-memory result.
- Both `/columns/import` and `/columns/import-async` enforce the entity CSV import payload bounds
  (`MAX_IMPORT_CSV_BYTES` 20 MiB, `MAX_IMPORT_CSV_ROWS` 100 000), rejected with 400 before any
  catalog walk.
- A synchronous `dryRun=false` import applies at most 200 column-occurrence updates
  (`ColumnRepository.MAX_SYNC_IMPORT_COLUMN_UPDATES`); identical rows are deduplicated before the
  count. A job above the cap is refused whole with 400 and the client is directed to
  `POST /api/v1/columns/import-async`, which is intentionally not update-capped because it runs on
  the bounded background pool rather than a request thread.
- Dry-run imports are not update-capped: after the single walk they cost one map lookup per row,
  the same bound as one `/columns/search` or `/columns/export`.

## Consequences

Larger bulk edits must use the async endpoint; clients of the synchronous write import (the UI
calls both) must handle the new 400s. The 200 value is a judgment call balancing a synchronous
request's latency against legitimate small bulk edits; raising it re-exposes the request-thread
exhaustion the cap exists for. Removing the per-row walk without the write cap is not sufficient:
rows naming a column present in every table still exhaust the request slots. Answering column
search from the search index would remove the single remaining full-catalog read, but is a larger
separate change.
