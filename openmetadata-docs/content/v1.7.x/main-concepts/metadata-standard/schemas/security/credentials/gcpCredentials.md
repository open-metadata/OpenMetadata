---
title: gcpCredentials | OpenMetadata GCP Credentials
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcpcredentials
---

# GCPCredentials

*GCP credentials configs.*

## Properties

- **`gcpConfig`**: We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP Credentials Path.
  - **One of**
    - : Refer to *[gcpValues.json](#pValues.json)*.
    - : Refer to *[#/definitions/gcpCredentialsPath](#definitions/gcpCredentialsPath)*.
    - : Refer to *[gcpExternalAccount.json](#pExternalAccount.json)*.
- **`gcpImpersonateServiceAccount`**: we enable the authenticated service account to impersonate another service account. Refer to *[#/definitions/GCPImpersonateServiceAccountValues](#definitions/GCPImpersonateServiceAccountValues)*.
## Definitions

- **`gcpCredentialsPath`** *(object)*: Pass the path of file containing the GCP credentials info.
  - **`type`** *(string)*: Google Cloud Platform account type. Default: `"gcp_credential_path"`.
  - **`path`** *(string)*: Path of the file containing the GCP credentials info.
  - **`projectId`** *(string)*: GCP Project ID to parse metadata from. Default: `null`.
- **`GCPImpersonateServiceAccountValues`** *(object)*: Pass the values to impersonate a service account of Google Cloud.
  - **`impersonateServiceAccount`** *(string)*: The impersonated service account email.
  - **`lifetime`** *(integer)*: Number of seconds the delegated credential should be valid. Default: `3600`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
