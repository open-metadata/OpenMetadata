---
title: nifiConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/nificonnection
---

# NifiConnection

*Nifi Metadata Pipeline Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/NifiType*. Default: `Nifi`.
- **`hostPort`** *(string)*: Pipeline Service Management/UI URI.
- **`nifiConfig`**: We support username/password or client certificate authentication.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`NifiType`** *(string)*: Service type. Must be one of: `['Nifi']`. Default: `Nifi`.
- **`basicAuthentication`** *(object)*: username/password auth. Cannot contain additional properties.
  - **`username`** *(string)*: Nifi user to authenticate to the API.
  - **`password`** *(string)*: Nifi password to authenticate to the API.
  - **`verifySSL`** *(boolean)*: Boolean marking if we need to verify the SSL certs for Nifi. False by default. Default: `False`.
- **`clientCertificateAuthentication`** *(object)*: client certificate auth. Cannot contain additional properties.
  - **`certificateAuthorityPath`** *(string)*: Path to the root CA certificate.
  - **`clientCertificatePath`** *(string)*: Path to the client certificate.
  - **`clientkeyPath`** *(string)*: Path to the client key.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
