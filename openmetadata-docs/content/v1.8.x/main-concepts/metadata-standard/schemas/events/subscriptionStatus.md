---
title: subscriptionStatus | OpenMetadata Subscription Status
description: Connect Subscriptionstatus to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/events/subscriptionstatus
---

# SubscriptionStatus

*Current status of the subscription, including details on the last successful and failed attempts, and retry information.*

## Properties

- **`status`** *(string)*: Status is `disabled` when the event subscription was created with `enabled` set to false and it never started publishing events. Status is `active` when the event subscription is functioning normally and a 200 OK response was received for the callback notification. Status is `failed` when a bad callback URL, connection failures, or `1xx` or `3xx` response was received for the callback notification. Status is `awaitingRetry` when the previous attempt at callback timed out or received a `4xx` or `5xx` response. Status is `retryLimitReached` after all retries fail. Must be one of: `["disabled", "failed", "retryLimitReached", "awaitingRetry", "active"]`.
- **`lastSuccessfulAt`**: Timestamp of the last successful callback in UNIX UTC epoch time in milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`lastFailedAt`**: Timestamp of the last failed callback in UNIX UTC epoch time in milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`lastFailedStatusCode`** *(integer)*: HTTP status code received during the last failed callback attempt.
- **`lastFailedReason`** *(string)*: Detailed reason for the last failure received during callback.
- **`nextAttempt`**: Timestamp for the next retry attempt in UNIX epoch time in milliseconds. Only valid if `status` is `awaitingRetry`. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`timestamp`**: Current timestamp of this status in UNIX epoch time in milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
