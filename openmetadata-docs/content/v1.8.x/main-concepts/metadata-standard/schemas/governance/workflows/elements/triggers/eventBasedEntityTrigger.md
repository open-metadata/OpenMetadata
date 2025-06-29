---
title: eventBasedEntityTrigger
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/triggers/eventbasedentitytrigger
---

# EventBasedEntityTriggerDefinition

*Event Based Entity Trigger.*

## Properties

- **`type`** *(string)*: Default: `"eventBasedEntityTrigger"`.
- **`config`**: Refer to *[#/definitions/config](#definitions/config)*.
- **`output`** *(array)*: Length must be equal to 1. Default: `["relatedEntity"]`.
  - **Items** *(string)*
## Definitions

- **`event`** *(string)*: Event for which it should be triggered. Must be one of: `["Created", "Updated"]`.
- **`config`** *(object)*: Entity Event Trigger Configuration. Cannot contain additional properties.
  - **`entityType`** *(string, required)*: Entity Type for which it should be triggered.
  - **`events`** *(array, required)*
    - **Items**: Refer to *[#/definitions/event](#definitions/event)*.
  - **`exclude`** *(array)*: Exclude events that only modify given attributes.
    - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
