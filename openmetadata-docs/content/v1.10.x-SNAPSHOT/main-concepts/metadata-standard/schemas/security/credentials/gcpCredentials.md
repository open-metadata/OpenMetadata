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

- **`gcpADC`** *(object)*: Use the application default credentials.
  - **`type`** *(string)*: Google Cloud Platform ADC ( Application Default Credentials ). Default: `gcp_adc`.
  - **`projectId`**: GCP Project ID to parse metadata from. Default: `None`.
- **`gcpCredentialsPath`** *(object)*: Pass the path of file containing the GCP credentials info.
  - **`type`** *(string)*: Google Cloud Platform account type. Default: `gcp_credential_path`.
  - **`path`** *(string)*: Path of the file containing the GCP credentials info.
  - **`projectId`**: GCP Project ID to parse metadata from. Default: `None`.
- **`GCPImpersonateServiceAccountValues`** *(object)*: Pass the values to impersonate a service account of Google Cloud.
  - **`impersonateServiceAccount`** *(string)*: The impersonated service account email.
  - **`lifetime`** *(integer)*: Number of seconds the delegated credential should be valid. Default: `3600`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
