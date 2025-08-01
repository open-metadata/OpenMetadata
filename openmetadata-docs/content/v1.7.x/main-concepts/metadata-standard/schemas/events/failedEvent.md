---
title: Failed Event Schema | Failed Event Information
description: Get started with failedevent. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/events/failedevent
---

# FailedEvents

*Failed Events Schema*

## Properties

- **`failingSubscriptionId`**: Unique identifier that identifies this Event Subscription. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`changeEvent`**: Change Event that failed. Refer to *[../type/changeEvent.json](#/type/changeEvent.json)*.
- **`reason`** *(string)*: Reason for failure.
- **`retriesLeft`** *(integer)*: Retries Left for the event.
- **`timestamp`**: Time of Failure. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
