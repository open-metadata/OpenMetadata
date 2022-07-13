---
title: gcsCredentials
slug: /main-concepts/metadata-standard/schemas/schema/security/credentials
---

# GCSCredentials

*GCS credentials configs.*

## Properties

- **`gcsConfig`**: GCS configs.
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


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
