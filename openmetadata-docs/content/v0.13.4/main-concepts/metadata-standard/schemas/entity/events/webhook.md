---
title: webhook
slug: /main-concepts/metadata-standard/schemas/entity/events/webhook
---

# Webhook

*This schema defines webhook for receiving events from OpenMetadata.*

## Properties

- **`endpoint`** *(string)*: Endpoint to receive the webhook events over POST requests.
- **`secretKey`** *(string)*: Secret set by the webhook client used for computing HMAC SHA256 signature of webhook payload and sent in `X-OM-Signature` header in POST requests to publish the events.
## Definitions

- **`entityName`** *(string)*: Unique name of the application receiving webhook events.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
