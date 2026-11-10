# S3 log storage turns on streamable logs for every deployed pipeline

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `IngestionPipelineRepositoryTest.deployFollowsTheServerLogStorageSetting`; `IngestionPipelineRepositoryTest.redeployBeforeUpdateKeepsTheFlagTheDeployDecided`; `IngestionPipelineRepositoryTest.editThatRedeploysRecordsTheFlagTheDeployDecided`; `IngestionPipelineRepositoryTest.runLogsAreReadFromWhereTheRunWroteThem`; `IngestionLogStreamFactoryTest.aRunIsTailedFromStorageWhenItsStateSaysItsLogsAreThere`
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
- Where a run's logs are read from follows that run, not the stored flag, which can differ from
  the configuration the run was deployed with. With S3 log storage, a run whose logs are stored
  (`logsExist`) is read from storage, a run still going (no finished status yet) is read from
  storage when its pipeline ships logs, and any other run is read from the runner. Without S3, the
  pipeline's flag decides, as before. `IngestionPipelineRepository.readsRunLogsFromStorage` holds
  the rule, and every reader goes through it: the last run's logs, their download, the live log
  stream and an application's logs.
- Two redeploys do not save the flag yet: a data contract redeploying a deployed pipeline, and the
  redeploy after deleting a pipeline of the same name. Their finished runs are still read from where
  they wrote; a run in progress is read from the runner until it finishes.

## Consequences

- Configuring S3 is the only step to keep logs: every pipeline, including future ones, stores them
  from its next deploy. Runs from before that deploy keep being read from the runner.
- When storage holds nothing for a finished run, because shipping failed or S3 cannot be read, the
  logs are read from the runner, which still has them for as long as it keeps them.
- Reading a finished run's logs costs one S3 lookup.
- With S3 configured, a pipeline cannot opt out of storing its logs.
- A new deploy path must call the hook and save its result, or its runs in progress are read from
  the runner until they finish.
- A new reader of run logs must go through `readsRunLogsFromStorage` rather than the flag.
- Removing `enabled` from the schema is a separate, breaking change for old configuration files.
