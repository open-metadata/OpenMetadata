---
title: webhook
slug: /main-concepts/metadata-standard/schemas/entity/events/webhook
---

# Webhook

*This schema defines webhook for receiving events from OpenMetadata.*

## Properties

- **`id`**: Unique ID associated with a webhook subscription. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Unique name of the application receiving webhook events. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this webhook.
- **`description`**: Description of the application. Refer to *../../type/basic.json#/definitions/markdown*.
- **`endpoint`** *(string)*: Endpoint to receive the webhook events over POST requests.
- **`eventFilters`** *(array)*: Endpoint to receive the webhook events over POST requests.
  - **Items**: Refer to *../../type/changeEvent.json#/definitions/eventFilter*.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `10`.
- **`timeout`** *(integer)*: Connection timeout in seconds. (Default 10s). Default: `10`.
- **`enabled`** *(boolean)*: When set to `true`, the webhook event notification is enabled. Set it to `false` to disable the subscription. (Default `true`). Default: `True`.
- **`secretKey`** *(string)*: Secret set by the webhook client used for computing HMAC SHA256 signature of webhook payload and sent in `X-OM-Signature` header in POST requests to publish the events.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`status`** *(string)*: Status is `disabled`, when webhook was created with `enabled` set to false and it never started publishing events. Status is `active` when webhook is normally functioning and 200 OK response was received for callback notification. Status is `failed` on bad callback URL, connection failures, `1xx`, and `3xx` response was received for callback notification. Status is `awaitingRetry` when previous attempt at callback timed out or received `4xx`, `5xx` response. Status is `retryLimitReached` after all retries fail. Must be one of: `['disabled', 'failed', 'retryLimitReached', 'awaitingRetry', 'active']`.
- **`failureDetails`** *(object)*: Failure details are set only when `status` is not `success`. Cannot contain additional properties.
  - **`lastSuccessfulAt`**: Last non-successful callback time in UNIX UTC epoch time in milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`lastFailedAt`**: Last non-successful callback time in UNIX UTC epoch time in milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`lastFailedStatusCode`** *(integer)*: Last non-successful activity response code received during callback.
  - **`lastFailedReason`** *(string)*: Last non-successful activity response reason received during callback.
  - **`nextAttempt`**: Next retry will be done at this time in Unix epoch time milliseconds. Only valid is `status` is `awaitingRetry`. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`href`**: Link to this webhook resource. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
