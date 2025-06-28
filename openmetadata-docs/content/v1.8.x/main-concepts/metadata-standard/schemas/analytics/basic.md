---
title: Basic Analytics Schema | OpenMetadata Basic Analytics
slug: /main-concepts/metadata-standard/schemas/analytics/basic
---

# Basic

*This schema defines basic types that are used by analytics classes*

## Definitions

- **`webAnalyticEventType`** *(string)*: event type. Must be one of: `["PageView", "CustomEvent"]`.
- **`fullUrl`** *(string)*: complete URL of the page.
- **`url`** *(string)*: url part after the domain specification.
- **`hostname`** *(string)*: domain name.
- **`sessionId`**: Unique ID identifying a session. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
