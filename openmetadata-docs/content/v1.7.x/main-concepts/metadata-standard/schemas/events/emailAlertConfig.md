---
title: emailAlertConfig | OpenMetadata Email Alert Config
slug: /main-concepts/metadata-standard/schemas/events/emailalertconfig
---

# EmailAlertConfig

*This schema defines email config for receiving events from OpenMetadata.*

## Properties

- **`receivers`** *(array)*: List of receivers to send mail to.
  - **Items** *(string)*
- **`sendToAdmins`** *(boolean)*: Send the Mails to Admins. Default: `false`.
- **`sendToOwners`** *(boolean)*: Send the Mails to Owners. Default: `false`.
- **`sendToFollowers`** *(boolean)*: Send the Mails to Followers. Default: `false`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
