---
title: failedEventResponse
slug: /main-concepts/metadata-standard/schemas/events/failedeventresponse
---

# FailedEvents

*Failed Events Schema*

## Properties

- **`failingSubscriptionId`**: Unique identifier that identifies this Event Subscription. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`changeEvent`**: Change Event that failed. Refer to *[../type/changeEvent.json](#/type/changeEvent.json)*.
- **`reason`** *(string)*: Reason for failure.
- **`source`** *(string)*: Source of the failed event.
- **`timestamp`**: Time of Failure. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
