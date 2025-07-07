---
title: Workflow Settings | OpenMetadata Workflow Config
slug: /main-concepts/metadata-standard/schemas/configuration/workflowsettings
---

# WorkflowSettings

*This schema defines the Workflow Settings.*

## Properties

- **`executorConfiguration`**: Used to set up the Workflow Executor Settings. Refer to *[#/definitions/executorConfiguration](#definitions/executorConfiguration)*.
- **`historyCleanUpConfiguration`**: Used to set up the History CleanUp Settings. Refer to *[#/definitions/historyCleanUpConfiguration](#definitions/historyCleanUpConfiguration)*.
## Definitions

- **`executorConfiguration`** *(object)*: Cannot contain additional properties.
  - **`corePoolSize`** *(integer)*: Default worker Pool Size. The Workflow Executor by default has this amount of workers. Default: `50`.
  - **`maxPoolSize`** *(integer)*: Maximum worker Pool Size. The Workflow Executor could grow up to this number of workers. Default: `100`.
  - **`queueSize`** *(integer)*: Amount of Tasks that can be queued to be picked up by the Workflow Executor. Default: `1000`.
  - **`tasksDuePerAcquisition`** *(integer)*: The amount of Tasks that the Workflow Executor is able to pick up each time it looks for more. Default: `20`.
- **`historyCleanUpConfiguration`** *(object)*: Cannot contain additional properties.
  - **`cleanAfterNumberOfDays`** *(integer)*: Cleans the Workflow Task that were finished, after given number of days. Default: `7`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
