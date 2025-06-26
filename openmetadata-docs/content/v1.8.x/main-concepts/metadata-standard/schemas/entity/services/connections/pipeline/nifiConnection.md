---
title: nifiConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/nificonnection
---

# NifiConnection

*Nifi Metadata Pipeline Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/NifiType](#definitions/NifiType)*. Default: `"Nifi"`.
- **`hostPort`** *(string, format: uri)*: Pipeline Service Management/UI URI.
- **`nifiConfig`**: We support username/password or client certificate authentication.
  - **One of**
    - : Refer to *[#/definitions/basicAuthentication](#definitions/basicAuthentication)*.
    - : Refer to *[#/definitions/clientCertificateAuthentication](#definitions/clientCertificateAuthentication)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`NifiType`** *(string)*: Service type. Must be one of: `["Nifi"]`. Default: `"Nifi"`.
- **`basicAuthentication`** *(object)*: username/password auth. Cannot contain additional properties.
  - **`username`** *(string)*: Nifi user to authenticate to the API.
  - **`password`** *(string, format: password)*: Nifi password to authenticate to the API.
  - **`verifySSL`** *(boolean)*: Boolean marking if we need to verify the SSL certs for Nifi. False by default. Default: `false`.
- **`clientCertificateAuthentication`** *(object)*: client certificate auth. Cannot contain additional properties.
  - **`certificateAuthorityPath`** *(string)*: Path to the root CA certificate.
  - **`clientCertificatePath`** *(string)*: Path to the client certificate.
  - **`clientkeyPath`** *(string)*: Path to the client key.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
