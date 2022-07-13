---
title: createWebhook
slug: /main-concepts/metadata-standard/schemas/schema/api/events
---

# CreateWebhook

*This schema defines webhook for receiving events from OpenMetadata*

## Properties

- **`name`**: Unique name of the application receiving webhook events. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this webhook.
- **`description`**: Description of the application. Refer to *../../type/basic.json#/definitions/markdown*.
- **`endpoint`** *(string)*: Endpoint to receive the webhook events over POST requests.
- **`eventFilters`** *(array)*: Event filters to filter for desired events.
  - **Items**: Refer to *../../type/changeEvent.json#/definitions/eventFilter*.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `10`.
- **`timeout`** *(integer)*: Connection timeout in seconds. (Default = 10s). Default: `10`.
- **`enabled`** *(boolean)*: When set to `true`, the webhook event notification is enabled. Set it to `false` to disable the subscription. (Default `true`). Default: `True`.
- **`secretKey`** *(string)*: Secret set by the webhook client used for computing HMAC SHA256 signature of webhook payload and sent in `X-OM-Signature` header in POST requests to publish the events.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
