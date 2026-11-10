# S3 log storage turns on streamable logs for every deployed pipeline

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `IngestionPipelineRepositoryTest.deployFollowsTheServerLogStorageSetting`; `IngestionPipelineRepositoryTest.redeployBeforeUpdateKeepsTheFlagTheDeployDecided`; `IngestionPipelineRepositoryTest.editThatRedeploysRecordsTheFlagTheDeployDecided`
- **Related:** #37287; #36568; PR #28741

## Context

A pipeline writes its logs to the server's log storage only when its `enableStreamableLogs` flag is
on. The flag is off by default and the UI does not show it. Before 2.0, a deploy turned it on when
the server stored logs in S3 and `logStorageConfiguration.enabled` (`PIPELINE_SERVICE_CLIENT_LOG_ENABLED`)
was true. PR #28741 moved that decision into one deploy hook, `applyStreamableLogsConfig`, so a
distribution could derive the flag from where the pipeline runs, and the default hook did nothing.
From then on an admin had to turn the flag on for each pipeline through the API, and a pipeline they
missed kept its logs only in its pod, which the Kubernetes orchestrator deletes.

## Decision

- The default `applyStreamableLogsConfig` sets `enableStreamableLogs` to true when log storage is
  `s3` with a bucket name. Otherwise it keeps the pipeline's own value. A subclass may override the
  hook and derive the flag another way.
- `logStorageConfiguration.enabled` is deprecated and nothing reads it. It stays in the schema only
  so existing configuration files keep loading.
- Every deploy path that saves the pipeline also saves the flag the deploy chose. A deploy that
  works on a copy, like `deployPipelineBeforeUpdate`, copies the flag back to the pipeline it
  stores.
- In the entity updater, `deployIfRequired` runs before `enableStreamableLogs` is compared, because
  the deploy can change the flag.
- Two redeploys do not save the flag yet: a data contract redeploying a deployed pipeline, and the
  redeploy after deleting a pipeline of the same name. Those pipelines read their logs from the pod
  until their next normal deploy.

## Consequences

- Configuring S3 is the only step to keep logs: every pipeline, including future ones, stores them
  from its next deploy. A pipeline's latest run shows no logs until that deploy.
- With S3 configured, a pipeline cannot opt out of storing its logs.
- A new deploy path must call the hook and save its result, or the stored pipeline reads its logs
  from the wrong place.
- Removing `enabled` from the schema is a separate, breaking change for old configuration files.
