---
title: gcpExternalAccount
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcpexternalaccount
---

# GCP External Account

*Pass the raw credential values provided by GCP*

## Properties

- **`type`** *(string)*: Google Cloud Platform account type. Default: `external_account`.
- **`externalType`** *(string)*: Google Cloud Platform account type. Default: `external_account`.
- **`audience`** *(string)*: Google Security Token Service audience which contains the resource name for the workload identity pool and the provider identifier in that pool.
- **`subjectTokenType`** *(string)*: Google Security Token Service subject token type based on the OAuth 2.0 token exchange spec.
- **`tokenURL`** *(string)*: Google Security Token Service token exchange endpoint.
- **`credentialSource`** *(object)*: This object defines the mechanism used to retrieve the external credential from the local environment so that it can be exchanged for a GCP access token via the STS endpoint. Can contain additional properties.
  - **Additional Properties** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
