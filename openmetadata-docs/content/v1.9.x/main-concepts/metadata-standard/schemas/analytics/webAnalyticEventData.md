---
title: webAnalyticEventData | Official Documentation
description: WebAnalyticEventData schema includes enriched fields for session, user, and engagement analytics.
slug: /main-concepts/metadata-standard/schemas/analytics/webanalyticeventdata
---

# webAnalyticEventData

*web analytics event data*

## Properties

- **`eventId`**: Unique identifier of the report. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`timestamp`**: event timestamp. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`eventType`**: event type. Refer to *[./basic.json#/definitions/webAnalyticEventType](#basic.json#/definitions/webAnalyticEventType)*.
- **`eventData`**: Web analytic data captured.
  - **One of**
    - : Refer to *[webAnalyticEventType/pageViewEvent.json](#bAnalyticEventType/pageViewEvent.json)*.
    - : Refer to *[webAnalyticEventType/customEvent.json](#bAnalyticEventType/customEvent.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
