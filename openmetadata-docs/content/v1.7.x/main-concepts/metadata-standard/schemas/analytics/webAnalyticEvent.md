---
title: Web Analytic Event | OpenMetadata Web Analytics Schema
slug: /main-concepts/metadata-standard/schemas/analytics/webanalyticevent
---

# WebAnalyticEvent

*Web Analytic Event*

## Properties

- **`id`**: Unique identifier of the report. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this event. Refer to *[../type/basic.json#/definitions/entityName](#/type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this web analytics event.
- **`description`**: Description of the event. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`eventType`**: event type. Refer to *[./basic.json#/definitions/webAnalyticEventType](#basic.json#/definitions/webAnalyticEventType)*.
- **`version`**: Metadata version of the entity. Refer to *[../type/entityHistory.json#/definitions/entityVersion](#/type/entityHistory.json#/definitions/entityVersion)*.
- **`owners`**: Owners of this report. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*. Default: `null`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who performed the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../type/basic.json#/definitions/href](#/type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../type/entityHistory.json#/definitions/changeDescription](#/type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`enabled`** *(boolean)*: Weather the event is enable (i.e. data is being collected). Default: `true`.
- **`domain`**: Domain the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
