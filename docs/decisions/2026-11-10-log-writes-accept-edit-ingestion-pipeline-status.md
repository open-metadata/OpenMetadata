# Writing a pipeline's run logs needs the permission that reports its status

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `IngestionPipelineLogStreamingResourceIT.testEveryAgentBotCanShipItsRunLogs`; `IngestionPipelineLogStreamingResourceIT.testLogWriteWithoutPermissionIsForbidden`
- **Related:** #37287; #36568; ADR:2026-11-10-s3-log-storage-drives-streamable-logs

## Context

A run ships its logs to the server with the token of its agent's bot, the same token it uses to
report its status and progress. Reporting status needs `EditIngestionPipelineStatus`, which every
agent bot has. Writing logs needed `EditAll` on the pipeline, which the Auto Classification bot does
not have, so the server refused every log upload from that agent and answered 500, while the run
still ended as successful.

## Decision

- `POST /v1/services/ingestionPipelines/logs/{fqn}/{runId}` and its `/close` are authorized with
  `EditIngestionPipelineStatus` or `EditAll` on the pipeline (`AuthorizationLogic.ANY`), like the
  other endpoints a run reports through.
- A caller with neither permission gets 403.

## Consequences

- Every agent bot can store its run logs, Auto Classification included.
- A custom role granted only `EditIngestionPipelineStatus` on a pipeline, for example to enable and
  disable it, can also write that pipeline's logs. This is intended: logs are part of what a run
  reports.
- Reading logs keeps its own permission check; this record covers writes only.
