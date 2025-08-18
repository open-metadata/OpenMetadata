---
title: GCP Values Credentials | OpenMetadata GCP Values Information
description: Provide GCP credential values for service account or OAuth-based access to Google Cloud services and APIs.
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcpvalues
---

# GCP Credentials Values

*Pass the raw credential values provided by GCP*

## Properties

- **`type`** *(string)*: Google Cloud Platform account type. Default: `"service_account"`.
- **`projectId`**: Project ID.
  - **One of**
    - : Refer to *[#/definitions/singleProjectId](#definitions/singleProjectId)*.
    - : Refer to *[#/definitions/multipleProjectId](#definitions/multipleProjectId)*.
- **`privateKeyId`** *(string)*: Google Cloud private key id.
- **`privateKey`** *(string, format: password)*: Google Cloud private key.
- **`clientEmail`** *(string)*: Google Cloud email.
- **`clientId`** *(string)*: Google Cloud Client ID.
- **`authUri`** *(string, format: uri)*: Google Cloud auth uri. Default: `"https://accounts.google.com/o/oauth2/auth"`.
- **`tokenUri`** *(string, format: uri)*: Google Cloud token uri. Default: `"https://oauth2.googleapis.com/token"`.
- **`authProviderX509CertUrl`** *(string, format: uri)*: Google Cloud auth provider certificate. Default: `"https://www.googleapis.com/oauth2/v1/certs"`.
- **`clientX509CertUrl`** *(string, format: uri)*: Google Cloud client certificate uri.
## Definitions

- **`singleProjectId`** *(string)*
- **`multipleProjectId`** *(array)*
  - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
