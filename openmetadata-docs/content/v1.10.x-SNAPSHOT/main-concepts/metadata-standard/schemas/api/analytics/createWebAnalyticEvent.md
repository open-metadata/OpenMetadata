---
title: createWebAnalyticEvent
slug: /main-concepts/metadata-standard/schemas/api/analytics/createwebanalyticevent
---

# CreateWebAnalyticEvent

*Payload to create a web analytic event*

## Properties

- **`name`**: Name that identifies this report definition. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name the report definition.
- **`description`**: Description of the report definition. Refer to *../../type/basic.json#/definitions/markdown*.
- **`eventType`**: dimension(s) and metric(s) for a report. Refer to *../../analytics/basic.json#/definitions/webAnalyticEventType*.
- **`owners`**: Owners of this report definition. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`domains`** *(array)*: Fully qualified names of the domains the Web Analytic Event belongs to.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
