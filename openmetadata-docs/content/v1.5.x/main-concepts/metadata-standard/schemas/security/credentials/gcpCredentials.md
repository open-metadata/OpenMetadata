---
title: gcpCredentials
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcpcredentials
---

# GCPCredentials

*GCP credentials configs.*

## Properties

- **`gcpConfig`**: We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP Credentials Path.
- **`gcpImpersonateServiceAccount`**: we enable the authenticated service account to impersonate another service account. Refer to *#/definitions/GCPImpersonateServiceAccountValues*.
## Definitions

- **`gcpCredentialsPath`** *(string)*: Pass the path of file containing the GCP credentials info.
- **`GCPImpersonateServiceAccountValues`** *(object)*: Pass the values to impersonate a service account of Google Cloud.
  - **`impersonateServiceAccount`** *(string)*: The impersonated service account email.
  - **`lifetime`** *(integer)*: Number of seconds the delegated credential should be valid. Default: `3600`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
