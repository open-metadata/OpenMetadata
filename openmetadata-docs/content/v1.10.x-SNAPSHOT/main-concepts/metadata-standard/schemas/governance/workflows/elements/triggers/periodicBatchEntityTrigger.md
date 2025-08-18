---
title: periodicBatchEntityTrigger
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/triggers/periodicbatchentitytrigger
---

# PeriodicBatchEntityTriggerDefinition

*Periodic Batch Entity Trigger.*

## Properties

- **`type`** *(string)*: Default: `periodicBatchEntity`.
- **`config`**: Refer to *#/definitions/config*.
- **`output`** *(array)*: Default: `['relatedEntity']`.
  - **Items** *(string)*
## Definitions

- **`config`** *(object)*: Entity Event Trigger Configuration. Cannot contain additional properties.
  - **`schedule`**: Defines the schedule of the Periodic Trigger. Refer to *../../../../entity/applications/app.json#definitions/appSchedule*.
  - **`entityType`** *(string)*: Entity Type for which it should be triggered.
  - **`filters`** *(string)*: Select the Search Filters to filter down the entities fetched.
  - **`batchSize`** *(integer)*: Number of Entities to process at once. Default: `500`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
