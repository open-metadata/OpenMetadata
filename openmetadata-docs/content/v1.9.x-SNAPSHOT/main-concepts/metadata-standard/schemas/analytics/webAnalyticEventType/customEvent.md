---
title: Custom Event Schema | OpenMetadata Custom Analytics Event
slug: /main-concepts/metadata-standard/schemas/analytics/webanalyticeventtype/customevent
---

# customData

*Event tracker (e.g. clicks, etc.)*

## Properties

- **`fullUrl`**: complete URL of the page. Refer to *[../basic.json#/definitions/fullUrl](#/basic.json#/definitions/fullUrl)*.
- **`url`**: url part after the domain specification. Refer to *[../basic.json#/definitions/url](#/basic.json#/definitions/url)*.
- **`hostname`**: domain name. Refer to *[../basic.json#/definitions/hostname](#/basic.json#/definitions/hostname)*.
- **`sessionId`**: Unique ID identifying a session. Refer to *[../basic.json#/definitions/sessionId](#/basic.json#/definitions/sessionId)*.
- **`eventType`**: Type of event that was performed. Refer to *[#/definitions/customEventTypes](#definitions/customEventTypes)*.
- **`eventValue`** *(string)*: Value of the event.
## Definitions

- **`customEventTypes`** *(string)*: Type of events that can be performed. Must be one of: `["CLICK"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
