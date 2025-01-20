---
title: eventSubscriptionDiagnosticInfo
slug: /main-concepts/metadata-standard/schemas/events/api/eventsubscriptiondiagnosticinfo
---

# Event Subscription Diagnostic Info

*Schema defining the response for event subscription diagnostics, including details about processed and unprocessed events.*

## Properties

- **`latestOffset`**: The latest offset of the event in the system.
- **`currentOffset`**: The current offset of the event subscription.
- **`startingOffset`**: The initial offset of the event subscription when it started processing.
- **`hasProcessedAllEvents`** *(boolean)*: Indicates whether all events have been processed.
- **`successfulEventsCount`**: Count of successful events for specific alert.
- **`failedEventsCount`**: Count of failed events for specific alert.
- **`relevantUnprocessedEventsCount`**: The number of relevant unprocessed events based on the alert's filtering rules for specific alert.
- **`totalUnprocessedEventsCount`**: The total number of unprocessed events.
- **`relevantUnprocessedEventsList`** *(array)*: A list of relevant unprocessed events based on the alert's filtering criteria.
  - **Items**: Refer to *[../../type/changeEvent.json](#/../type/changeEvent.json)*.
- **`totalUnprocessedEventsList`** *(array)*: A list of all unprocessed events.
  - **Items**: Refer to *[../../type/changeEvent.json](#/../type/changeEvent.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
