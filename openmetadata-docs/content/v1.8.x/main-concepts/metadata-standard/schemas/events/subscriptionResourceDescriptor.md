---
title: subscriptionResourceDescriptor
slug: /main-concepts/metadata-standard/schemas/events/subscriptionresourcedescriptor
---

# SubscriptionResourceDescriptor

*Subscription descriptor*

## Properties

- **`name`** *(string)*: Name of the resource. For entity related resources, resource name is same as the entity name. Some resources such as lineage are not entities but are resources.
- **`supportedFilters`** *(array)*: List of operations supported filters by the resource.
  - **Items**: Refer to *[#/definitions/operation](#definitions/operation)*.
## Definitions

- **`operation`** *(string)*: This schema defines all possible filter operations on metadata of entities in OpenMetadata. Must be one of: `["filterBySource", "filterByEntityId", "filterByOwnerName", "filterByFqn", "filterByEventType", "filterByUpdaterName", "filterByFieldChange", "filterByDomain", "filterByMentionedName", "filterByGeneralMetadataEvents"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
