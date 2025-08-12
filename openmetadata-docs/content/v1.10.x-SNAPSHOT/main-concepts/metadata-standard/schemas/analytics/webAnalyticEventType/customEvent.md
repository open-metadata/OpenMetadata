---
title: customEvent
slug: /main-concepts/metadata-standard/schemas/analytics/webanalyticeventtype/customevent
---

# customData

*Event tracker (e.g. clicks, etc.)*

## Properties

- **`fullUrl`**: complete URL of the page. Refer to *../basic.json#/definitions/fullUrl*.
- **`url`**: url part after the domain specification. Refer to *../basic.json#/definitions/url*.
- **`hostname`**: domain name. Refer to *../basic.json#/definitions/hostname*.
- **`sessionId`**: Unique ID identifying a session. Refer to *../basic.json#/definitions/sessionId*.
- **`eventType`**: Type of event that was performed. Refer to *#/definitions/customEventTypes*.
- **`eventValue`** *(string)*: Value of the event.
## Definitions

- **`customEventTypes`** *(string)*: Type of events that can be performed. Must be one of: `['CLICK']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
