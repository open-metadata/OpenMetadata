---
title: gcpValues
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcpvalues
---

# GCP Credentials Values

*Pass the raw credential values provided by GCP*

## Properties

- **`type`** *(string)*: Google Cloud Platform account type. Default: `service_account`.
- **`projectId`**: Project ID.
- **`privateKeyId`** *(string)*: Google Cloud private key id.
- **`privateKey`** *(string)*: Google Cloud private key.
- **`clientEmail`** *(string)*: Google Cloud email.
- **`clientId`** *(string)*: Google Cloud Client ID.
- **`authUri`** *(string)*: Google Cloud auth uri. Default: `https://accounts.google.com/o/oauth2/auth`.
- **`tokenUri`** *(string)*: Google Cloud token uri. Default: `https://oauth2.googleapis.com/token`.
- **`authProviderX509CertUrl`** *(string)*: Google Cloud auth provider certificate. Default: `https://www.googleapis.com/oauth2/v1/certs`.
- **`clientX509CertUrl`** *(string)*: Google Cloud client certificate uri.
## Definitions

- **`singleProjectId`** *(string)*
- **`multipleProjectId`** *(array)*
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
