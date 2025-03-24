---
title: createWebAnalyticEvent
slug: /main-concepts/metadata-standard/schemas/api/analytics/createwebanalyticevent
---

# CreateWebAnalyticEvent

*Payload to create a web analytic event*

## Properties

- **`name`**: Name that identifies this report definition. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name the report definition.
- **`description`**: Description of the report definition. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`eventType`**: dimension(s) and metric(s) for a report. Refer to *[../../analytics/basic.json#/definitions/webAnalyticEventType](#/../analytics/basic.json#/definitions/webAnalyticEventType)*.
- **`owners`**: Owners of this report definition. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
