---
title: qlikSenseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/qliksenseconnection
---

# QlikSenseConnection

*Qlik Sense Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/qlikSenseType](#definitions/qlikSenseType)*. Default: `"QlikSense"`.
- **`displayUrl`** *(string, format: uri)*: Qlik Sense Base URL, used for genrating dashboard & chat url.
- **`hostPort`** *(string, format: uri)*: URL for the superset instance.
- **`certificates`**
  - **One of**
    - : Refer to *[#/definitions/qlikCertificateValues](#definitions/qlikCertificateValues)*.
    - : Refer to *[#/definitions/qlikCertificatePath](#definitions/qlikCertificatePath)*.
- **`userDirectory`** *(string)*: User Directory.
- **`userId`** *(string)*: User ID.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/qlikSenseType"></a>**`qlikSenseType`** *(string)*: Qlik sense service type. Must be one of: `["QlikSense"]`. Default: `"QlikSense"`.
- <a id="definitions/qlikCertificatePath"></a>**`qlikCertificatePath`** *(object)*: Qlik Authentication Certificate File Path.
  - **`clientCertificate`** *(string, required)*: Client Certificate.
  - **`clientKeyCertificate`** *(string, required)*: Client Key Certificate.
  - **`rootCertificate`** *(string, required)*: Root Certificate.
- <a id="definitions/qlikCertificateValues"></a>**`qlikCertificateValues`** *(object)*: Qlik Authentication Certificate By Values.
  - **`clientCertificateData`** *(string, format: password, required)*: Client Certificate.
  - **`clientKeyCertificateData`** *(string, format: password, required)*: Client Key Certificate.
  - **`rootCertificateData`** *(string, format: password, required)*: Root Certificate.
  - **`stagingDir`** *(string, required)*: Staging Directory Path. Default: `"/tmp/openmetadata-qlik"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
