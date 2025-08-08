---
title: smtpSettings
slug: /main-concepts/metadata-standard/schemas/email/smtpsettings
---

# SmtpSettings

*This schema defines the SMTP Settings for sending Email*

## Properties

- **`emailingEntity`** *(string)*: Emailing Entity. Default: `OpenMetadata`.
- **`supportUrl`** *(string)*: Support Url. Default: `https://slack.open-metadata.org`.
- **`enableSmtpServer`** *(boolean)*: If this is enable password will details will be shared on mail. Default: `False`.
- **`senderMail`** *(string)*: Mail of the sender.
- **`serverEndpoint`** *(string)*: Smtp Server Endpoint.
- **`serverPort`** *(integer)*: Smtp Server Port.
- **`username`** *(string)*: Smtp Server Username.
- **`password`** *(string)*: Smtp Server Password.
- **`transportationStrategy`** *(string)*: Must be one of: `['SMTP', 'SMTPS', 'SMTP_TLS']`. Default: `SMTP`.
- **`templatePath`** *(string)*
- **`templates`** *(string)*: Must be one of: `['openmetadata', 'collate']`. Default: `openmetadata`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
