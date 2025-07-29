---
title: Periodicbatchentitytrigger | Official Documentation
description: Define periodic batch entity trigger to execute workflows at scheduled intervals or cycles.
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/triggers/periodicbatchentitytrigger
---

# PeriodicBatchEntityTriggerDefinition

*Periodic Batch Entity Trigger.*

## Properties

- **`type`** *(string)*: Default: `"periodicBatchEntityTrigger"`.
- **`config`**: Refer to *[#/definitions/config](#definitions/config)*.
- **`output`** *(array)*: Length must be equal to 1. Default: `["relatedEntity"]`.
  - **Items** *(string)*
## Definitions

- **`config`** *(object)*: Entity Event Trigger Configuration. Cannot contain additional properties.
  - **`schedule`**: Defines the schedule of the Periodic Trigger. Refer to *[../../../../entity/applications/app.json#definitions/appSchedule](#/../../../entity/applications/app.json#definitions/appSchedule)*.
  - **`entityType`** *(string, required)*: Entity Type for which it should be triggered.
  - **`filters`** *(string, required)*: Search Filters to filter down the entities fetched.
  - **`batchSize`** *(integer)*: Number of Entities to process at once. Default: `500`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
