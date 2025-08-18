---
title: Page View Event Schema | OpenMetadata Page View Analytics
description: Connect Pageviewevent to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/analytics/webanalyticeventtype/pageviewevent
---

# pageViewData

*Page view data event*

## Properties

- **`fullUrl`**: complete URL of the page. Refer to *[../basic.json#/definitions/fullUrl](#/basic.json#/definitions/fullUrl)*.
- **`url`**: url part after the domain specification. Refer to *[../basic.json#/definitions/url](#/basic.json#/definitions/url)*.
- **`hostname`**: domain name. Refer to *[../basic.json#/definitions/hostname](#/basic.json#/definitions/hostname)*.
- **`language`** *(string)*: language set on the page.
- **`screenSize`** *(string)*: Size of the screen.
- **`userId`**: OpenMetadata logged in user Id. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`sessionId`**: Unique ID identifying a session. Refer to *[../basic.json#/definitions/sessionId](#/basic.json#/definitions/sessionId)*.
- **`pageLoadTime`** *(number)*: time for the page to load in seconds.
- **`referrer`** *(string)*: referrer URL.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
