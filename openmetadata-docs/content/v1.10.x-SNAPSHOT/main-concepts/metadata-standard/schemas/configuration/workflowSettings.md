---
title: workflowSettings
slug: /main-concepts/metadata-standard/schemas/configuration/workflowsettings
---

# WorkflowSettings

*This schema defines the Workflow Settings.*

## Properties

- **`executorConfiguration`**: Used to set up the Workflow Executor Settings. Refer to *#/definitions/executorConfiguration*.
- **`historyCleanUpConfiguration`**: Used to set up the History CleanUp Settings. Refer to *#/definitions/historyCleanUpConfiguration*.
## Definitions

- **`executorConfiguration`** *(object)*: Cannot contain additional properties.
  - **`corePoolSize`** *(integer)*: Default worker Pool Size. The Workflow Executor by default has this amount of workers. Default: `10`.
  - **`maxPoolSize`** *(integer)*: Maximum worker Pool Size. The Workflow Executor could grow up to this number of workers. Default: `20`.
  - **`queueSize`** *(integer)*: Amount of Tasks that can be queued to be picked up by the Workflow Executor. Default: `1000`.
  - **`tasksDuePerAcquisition`** *(integer)*: The amount of Tasks that the Workflow Executor is able to pick up each time it looks for more. Default: `20`.
  - **`jobLockTimeInMillis`** *(integer)*: The amount of time a Job gets locked before being retried. Default: 15 Days. This avoids jobs that takes too long to run being retried while running. Default: `1296000000`.
- **`historyCleanUpConfiguration`** *(object)*: Cannot contain additional properties.
  - **`cleanAfterNumberOfDays`** *(integer)*: Cleans the Workflow Task that were finished, after given number of days. Default: `7`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
