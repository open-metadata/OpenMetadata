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

- **`operation`** *(string)*: This schema defines all possible filter operations on metadata of entities in OpenMetadata. Must be one of: `['filterBySource', 'filterByEntityId', 'filterByOwnerName', 'filterByFqn', 'filterByEventType', 'filterByUpdaterName', 'filterByFieldChange', 'filterByDomain', 'filterByMentionedName', 'filterByGeneralMetadataEvents', 'filterByUpdaterIsBot']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
