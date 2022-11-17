---
title: pageViewEvent
slug: /main-concepts/metadata-standard/schemas/analytics/webanalyticeventtype/pageviewevent
---

# pageViewData

*Page view data event*

## Properties

- **`fullUrl`** *(string)*: complete URL of the page.
- **`url`** *(string)*: url part after the domain specification.
- **`hostname`** *(string)*: domain name.
- **`language`** *(string)*: language set on the page.
- **`screenSize`** *(string)*: Size of the screen.
- **`userId`**: OpenMetadata logged in user Id. Refer to *../../type/basic.json#/definitions/uuid*.
- **`sessionId`**: Unique ID identifying a session. Refer to *../../type/basic.json#/definitions/uuid*.
- **`pageLoadTime`** *(number)*: time for the page to load in seconds.
- **`referrer`** *(string)*: referrer URL.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
