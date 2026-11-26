# Requests under /v1/pipelines read a status history at most 1,000 statuses at a time

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `PipelineStatusPaginationSqlTest` (rows each read loads, on MySQL and PostgreSQL),
  `PipelineResourceIT.list_pipelineStatuses_pagedByDefault_200_OK`
- **Related:** #36446 (the status list paged in SQL)

## Context
`GET /v1/pipelines/{fqn}/status` paged in SQL only when the caller sent a positive `limit`. Without
one, or with 0, it read every status between `startTs` and `endTs` into memory, and `limit` itself
could be 1,000,000. Anyone who can view a pipeline chooses that range, and a history grows by up to
1,000 statuses per bulk write, so one request could hold the whole history in the heap. Two other
reads of a pipeline's status history had the same shape: the bulk write loaded every stored status
between its first and last timestamp to find the rows it overwrites, and the observability summary
loaded every run of the last 30 days to average their runtime.

## Decision
- The status list always pages in SQL. `limit` defaults to 10 and is at most
  `PipelineRepository.MAX_PIPELINE_STATUS_PAGE_SIZE` (1,000); 0 returns only `paging.total`, as the
  entity lists do.
- A client that needs a whole range follows `paging.after` until a page comes back short. The UI's
  Executions tab, the Java SDK's `listPipelineStatuses(fqn, startTs, endTs)` and the Python
  `list_pipeline_statuses` page this way, 1,000 statuses at a time; each keeps its own copy of the
  maximum and cites this record.
- The bulk write reads only the stored statuses at the timestamps it writes, so its lookup is never
  larger than its body, which `@Size(max = 1000)` caps separately.
- The observability average runtime is an `AVG` over the last 30 days computed in SQL
  (ADR:2026-11-06-pipeline-run-runtime-has-one-sql-definition), so it reads no status into the
  server.

## Consequences
- No request under `/v1/pipelines` reads more than 1,000 statuses of a pipeline's history at once,
  however long that history is; the average runtime and the trend and metrics endpoints aggregate
  in SQL. The bound counts statuses, not bytes: how large a single status may be is not limited
  here.
- An API caller that omitted `limit` to receive the whole range now receives 10 statuses and has to
  follow the cursor; a `limit` above 1,000, accepted before, is refused with 400.
- A client that follows the cursor through a whole range still holds that range itself: the
  Executions tab reads every run of the range it shows, one page per request.
- The maximum and the clients' page size are the same number, so lowering the maximum means
  changing those clients with it.
