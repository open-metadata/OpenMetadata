---
title: webhook
slug: /main-concepts/metadata-standard/schemas/entity/events/webhook
---

# Webhook

*This schema defines webhook for receiving events from OpenMetadata.*

## Properties

- **`receivers`** *(array)*: List of receivers to send mail to.
  - **Items** *(string)*
- **`endpoint`** *(string)*: Endpoint to receive the webhook events over POST requests.
- **`secretKey`** *(string)*: Secret set by the webhook client used for computing HMAC SHA256 signature of webhook payload and sent in `X-OM-Signature` header in POST requests to publish the events.
- **`headers`** *(object)*: Custom headers to be sent with the webhook request.
- **`queryParams`** *(object)*: Query parameters to be added to the webhook request URL.
- **`httpMethod`** *(string)*: HTTP operation to send the webhook request. Supports POST or PUT. Must be one of: `['POST', 'PUT']`. Default: `POST`.
- **`sendToAdmins`** *(boolean)*: Send the Event to Admins. Default: `False`.
- **`sendToOwners`** *(boolean)*: Send the Event to Owners. Default: `False`.
- **`sendToFollowers`** *(boolean)*: Send the Event to Followers. Default: `False`.
## Definitions

- **`entityName`** *(string)*: Unique name of the application receiving webhook events.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
