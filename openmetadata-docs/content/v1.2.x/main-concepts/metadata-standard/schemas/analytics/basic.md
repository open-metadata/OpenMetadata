---
title: basic
slug: /main-concepts/metadata-standard/schemas/analytics/basic
---

# Basic

*This schema defines basic types that are used by analytics classes*

## Definitions

- <a id="definitions/webAnalyticEventType"></a>**`webAnalyticEventType`** *(string)*: event type. Must be one of: `["PageView", "CustomEvent"]`.
- <a id="definitions/fullUrl"></a>**`fullUrl`** *(string)*: complete URL of the page.
- <a id="definitions/url"></a>**`url`** *(string)*: url part after the domain specification.
- <a id="definitions/hostname"></a>**`hostname`** *(string)*: domain name.
- <a id="definitions/sessionId"></a>**`sessionId`**: Unique ID identifying a session. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
