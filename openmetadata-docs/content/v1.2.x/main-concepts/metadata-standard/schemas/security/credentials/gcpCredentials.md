---
title: gcpCredentials
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcpcredentials
---

# GCPCredentials

*GCP credentials configs.*

## Properties

- **`gcpConfig`**: We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP Credentials Path.
  - **One of**
    - : Refer to *[gcpValues.json](#pValues.json)*.
    - : Refer to *[#/definitions/gcpCredentialsPath](#definitions/gcpCredentialsPath)*.
- **`gcpImpersonateServiceAccount`**: we enable the authenticated service account to impersonate another service account. Refer to *[#/definitions/GCPImpersonateServiceAccountValues](#definitions/GCPImpersonateServiceAccountValues)*.
## Definitions

- <a id="definitions/gcpCredentialsPath"></a>**`gcpCredentialsPath`** *(string)*: Pass the path of file containing the GCP credentials info.
- <a id="definitions/GCPImpersonateServiceAccountValues"></a>**`GCPImpersonateServiceAccountValues`** *(object)*: Pass the values to impersonate a service account of Google Cloud.
  - **`impersonateServiceAccount`** *(string)*: The impersonated service account email.
  - **`lifetime`** *(integer)*: Number of seconds the delegated credential should be valid. Default: `3600`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
