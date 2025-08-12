---
title: SMTP Settings | OpenMetadata SMTP Config
description: Connect Smtpsettings to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/email/smtpsettings
---

# SmtpSettings

*This schema defines the SMTP Settings for sending Email*

## Properties

- **`emailingEntity`** *(string)*: Emailing Entity. Default: `"OpenMetadata"`.
- **`supportUrl`** *(string)*: Support Url. Default: `"https://slack.open-metadata.org"`.
- **`enableSmtpServer`** *(boolean)*: If this is enable password will details will be shared on mail. Default: `false`.
- **`openMetadataUrl`** *(string)*: Openmetadata Server Endpoint.
- **`senderMail`** *(string)*: Mail of the sender.
- **`serverEndpoint`** *(string)*: Smtp Server Endpoint.
- **`serverPort`** *(integer)*: Smtp Server Port.
- **`username`** *(string)*: Smtp Server Username.
- **`password`** *(string)*: Smtp Server Password.
- **`transportationStrategy`** *(string)*: Must be one of: `["SMTP", "SMTPS", "SMTP_TLS"]`. Default: `"SMTP"`.
- **`templatePath`** *(string)*
- **`templates`** *(string)*: Must be one of: `["openmetadata", "collate"]`. Default: `"openmetadata"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
