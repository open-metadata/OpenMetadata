---
title: GCPCredentials
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcpcredentials
---

# GCSCredentials

*GCS credentials configs.*

## Properties

- **`gcpConfig`**: GCS configs.
## Definitions

- **`GCSValues`** *(object)*: GCS Credentials. Cannot contain additional properties.
  - **`type`** *(string)*: Google Cloud service account type.
  - **`projectId`** *(string)*: Google Cloud project id.
  - **`privateKeyId`** *(string)*: Google Cloud private key id.
  - **`privateKey`** *(string)*: Google Cloud private key.
  - **`clientEmail`** *(string)*: Google Cloud email.
  - **`clientId`** *(string)*: Google Cloud Client ID.
  - **`authUri`** *(string)*: Google Cloud auth uri. Default: `https://accounts.google.com/o/oauth2/auth`.
  - **`tokenUri`** *(string)*: Google Cloud token uri. Default: `https://oauth2.googleapis.com/token`.
  - **`authProviderX509CertUrl`** *(string)*: Google Cloud auth provider certificate. Default: `https://www.googleapis.com/oauth2/v1/certs`.
  - **`clientX509CertUrl`** *(string)*: Google Cloud client certificate uri.
- **`GCSCredentialsPath`** *(string)*: GCS Credentials Path.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
