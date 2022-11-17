---
title: gcsCredentials
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcscredentials
---

# GCSCredentials

*GCS credentials configs.*

## Properties

- **`gcsConfig`**: We support two ways of authenticating to GCS i.e via GCS Credentials Values or GCS Credentials Path.
## Definitions

- **`GCSValues`** *(object)*: Pass the raw credential values provided by GCS. Cannot contain additional properties.
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
- **`GCSCredentialsPath`** *(string)*: Pass the path of file containing the GCS credentials info.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
