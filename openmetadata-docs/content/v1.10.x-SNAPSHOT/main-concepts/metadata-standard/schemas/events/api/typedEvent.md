---
title: typedEvent
slug: /main-concepts/metadata-standard/schemas/events/api/typedevent
---

# Typed Event

*Schema defining a Typed Event with its status, data, and timestamp.*

## Properties

- **`status`** *(string)*: The status of the event, such as 'failed', 'successful', or 'unprocessed'. Must be one of: `['failed', 'successful', 'unprocessed']`.
- **`data`** *(array)*: The event data, which can be of different types depending on the status.
  - **Items**
- **`timestamp`** *(number)*: The timestamp when the event occurred, represented as a long.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
