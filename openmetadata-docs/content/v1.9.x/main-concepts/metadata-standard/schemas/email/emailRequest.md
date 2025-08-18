---
title: Email Request | OpenMetadata Email Requests
description: Connect Emailrequest to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/email/emailrequest
---

# EmailRequest

*This schema defines the Email Request for creating Email*

## Properties

- **`senderName`** *(string)*: Sender Name.
- **`senderMail`** *(string)*: From Email Address.
- **`recipientMails`** *(array)*: List of Receiver Name with Email.
  - **Items**: Refer to *[#/definitions/nameEmailPair](#definitions/nameEmailPair)*.
- **`ccMails`** *(array)*: List of CC.
  - **Items**: Refer to *[#/definitions/nameEmailPair](#definitions/nameEmailPair)*.
- **`bccMails`** *(array)*: List of BCC.
  - **Items**: Refer to *[#/definitions/nameEmailPair](#definitions/nameEmailPair)*.
- **`subject`** *(string)*: Subject for Mail.
- **`contentType`** *(string)*: Must be one of: `["plain", "html"]`. Default: `"plain"`.
- **`content`** *(string)*: Content for mail.
## Definitions

- **`nameEmailPair`** *(object)*: Name Email Pair. Cannot contain additional properties.
  - **`name`** *(string)*: Name.
  - **`email`**: Email address of the user. Refer to *[../type/basic.json#/definitions/email](#/type/basic.json#/definitions/email)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
