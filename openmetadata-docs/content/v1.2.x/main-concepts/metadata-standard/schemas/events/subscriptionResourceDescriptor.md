---
title: subscriptionResourceDescriptor
slug: /main-concepts/metadata-standard/schemas/events/subscriptionresourcedescriptor
---

# SubscriptionResourceDescriptor

*Subscription descriptor*

## Properties

- **`name`** *(string)*: Name of the resource. For entity related resources, resource name is same as the entity name. Some resources such as lineage are not entities but are resources.
- **`supportedFilters`** *(array)*: List of operations supported filters by the resource.
  - **Items**: Refer to *#/definitions/operation*.
## Definitions

- **`operation`** *(string)*: This schema defines all possible filter operations on metadata of entities in OpenMetadata. Must be one of: `['matchAnySource', 'matchAnyOwnerName', 'matchAnyEntityFqn', 'matchAnyEntityId', 'matchAnyEventType', 'matchTestResult', 'matchUpdatedBy', 'matchIngestionPipelineState', 'matchAnyFieldChange']`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
