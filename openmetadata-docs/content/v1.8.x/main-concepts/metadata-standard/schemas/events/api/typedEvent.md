---
title: Typed Event Schema | OpenMetadata Typed Event Details
slug: /main-concepts/metadata-standard/schemas/events/api/typedevent
---

# Typed Event

*Schema defining a Typed Event with its status, data, and timestamp.*

## Properties

- **`status`** *(string)*: The status of the event, such as 'failed', 'successful', or 'unprocessed'. Must be one of: `["failed", "successful", "unprocessed"]`.
- **`data`** *(array)*: The event data, which can be of different types depending on the status.
  - **Items**
    - **One of**
      - : Refer to *[../../type/changeEvent.json](#/../type/changeEvent.json)*.
      - : Refer to *[../failedEventResponse.json](#/failedEventResponse.json)*.
- **`timestamp`** *(number, format: int64)*: The timestamp when the event occurred, represented as a long.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
