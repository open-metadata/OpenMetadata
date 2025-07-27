---
title: Qlik Sense Connection | OpenMetadata Qlik Sense
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/qliksenseconnection
---

# QlikSenseConnection

*Qlik Sense Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/qlikSenseType](#definitions/qlikSenseType)*. Default: `"QlikSense"`.
- **`displayUrl`** *(string, format: uri)*: Qlik Sense Base URL, used for genrating dashboard & chat url.
- **`hostPort`** *(string, format: uri)*: URL for the Qlik instance.
- **`certificates`**
  - **One of**
    - : Refer to *[#/definitions/qlikCertificateValues](#definitions/qlikCertificateValues)*.
    - : Refer to *[#/definitions/qlikCertificatePath](#definitions/qlikCertificatePath)*.
- **`validateHostName`** *(boolean)*: Validate Host Name. Default: `false`.
- **`userDirectory`** *(string)*: User Directory.
- **`userId`** *(string)*: User ID.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`qlikSenseType`** *(string)*: Qlik sense service type. Must be one of: `["QlikSense"]`. Default: `"QlikSense"`.
- **`qlikCertificatePath`** *(object)*: Qlik Authentication Certificate File Path.
  - **`clientCertificate`** *(string, required)*: Client Certificate.
  - **`clientKeyCertificate`** *(string, required)*: Client Key Certificate.
  - **`rootCertificate`** *(string, required)*: Root Certificate.
- **`qlikCertificateValues`** *(object)*: Qlik Authentication Certificate By Values.
  - **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
