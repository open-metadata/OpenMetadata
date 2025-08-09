---
title: eventBasedEntityTrigger
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/triggers/eventbasedentitytrigger
---

# EventBasedEntityTriggerDefinition

*Event Based Entity Trigger.*

## Properties

- **`type`** *(string)*: Default: `eventBasedEntity`.
- **`config`**: Refer to *#/definitions/config*.
- **`output`** *(array)*: Default: `['relatedEntity']`.
  - **Items** *(string)*
## Definitions

- **`event`** *(string)*: Event for which it should be triggered. Must be one of: `['Created', 'Updated']`.
- **`config`** *(object)*: Entity Event Trigger Configuration. Cannot contain additional properties.
  - **`entityType`** *(string)*: Entity Type for which it should be triggered.
  - **`events`** *(array)*
    - **Items**: Refer to *#/definitions/event*.
  - **`exclude`** *(array)*: Select fields that should not trigger the workflow if only them are modified.
    - **Items** *(string)*
  - **`filter`** *(string)*: JSON Logic expression to determine if the workflow should be triggered. The expression has access to: entity (current entity), changeDescription (what changed), updatedBy (user who made the change), changedFields (array of field names that changed).


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
