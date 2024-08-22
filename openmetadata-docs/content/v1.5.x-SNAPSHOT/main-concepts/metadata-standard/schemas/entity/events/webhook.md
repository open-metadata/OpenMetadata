---
title: webhook
slug: /main-concepts/metadata-standard/schemas/entity/events/webhook
---

# Webhook

*This schema defines webhook for receiving events from OpenMetadata.*

## Properties

- **`endpoint`** *(string)*: Endpoint to receive the webhook events over POST requests.
- **`secretKey`** *(string)*: Secret set by the webhook client used for computing HMAC SHA256 signature of webhook payload and sent in `X-OM-Signature` header in POST requests to publish the events.
- **`sendToAdmins`** *(boolean)*: Send the Event to Admins. Default: `False`.
- **`sendToOwners`** *(boolean)*: Send the Event to Owners. Default: `False`.
- **`sendToFollowers`** *(boolean)*: Send the Event to Followers. Default: `False`.
## Definitions

- **`entityName`** *(string)*: Unique name of the application receiving webhook events.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
