---
title: qlikSenseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/qliksenseconnection
---

# QlikSenseConnection

*Qlik Sense Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/qlikSenseType*. Default: `QlikSense`.
- **`displayUrl`** *(string)*: Qlik Sense Base URL, used for genrating dashboard & chat url.
- **`hostPort`** *(string)*: URL for the superset instance.
- **`certificates`**
- **`userDirectory`** *(string)*: User Directory.
- **`userId`** *(string)*: User ID.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`qlikSenseType`** *(string)*: Qlik sense service type. Must be one of: `['QlikSense']`. Default: `QlikSense`.
- **`qlikCertificatePath`** *(object)*: Qlik Authentication Certificate File Path.
  - **`clientCertificate`** *(string)*: Client Certificate.
  - **`clientKeyCertificate`** *(string)*: Client Key Certificate.
  - **`rootCertificate`** *(string)*: Root Certificate.
- **`qlikCertificateValues`** *(object)*: Qlik Authentication Certificate By Values.
  - **`clientCertificateData`** *(string)*: Client Certificate.
  - **`clientKeyCertificateData`** *(string)*: Client Key Certificate.
  - **`rootCertificateData`** *(string)*: Root Certificate.
  - **`stagingDir`** *(string)*: Staging Directory Path. Default: `/tmp/openmetadata-qlik`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
