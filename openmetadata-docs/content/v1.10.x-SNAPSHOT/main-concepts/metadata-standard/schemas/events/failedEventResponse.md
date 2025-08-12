---
title: failedEventResponse
slug: /main-concepts/metadata-standard/schemas/events/failedeventresponse
---

# FailedEvents

*Failed Events Schema*

## Properties

- **`failingSubscriptionId`**: Unique identifier that identifies this Event Subscription. Refer to *../type/basic.json#/definitions/uuid*.
- **`changeEvent`**: Change Event that failed. Refer to *../type/changeEvent.json*.
- **`reason`** *(string)*: Reason for failure.
- **`source`** *(string)*: Source of the failed event.
- **`timestamp`**: Time of Failure. Refer to *../type/basic.json#/definitions/timestamp*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
