---
title: qlikSenseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/qliksenseconnection
---

# QlikSenseConnection

*Qlik Sense Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/qlikSenseType*. Default: `QlikSense`.
- **`displayUrl`** *(string)*: Qlik Sense Base URL, used for genrating dashboard & chat url.
- **`hostPort`** *(string)*: URL for the Qlik instance.
- **`certificates`**
- **`validateHostName`** *(boolean)*: Validate Host Name. Default: `False`.
- **`userDirectory`** *(string)*: User Directory.
- **`userId`** *(string)*: User ID.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`qlikSenseType`** *(string)*: Qlik sense service type. Must be one of: `['QlikSense']`. Default: `QlikSense`.
- **`qlikCertificatePath`** *(object)*: Qlik Authentication Certificate File Path.
  - **`clientCertificate`** *(string)*: Client Certificate.
  - **`clientKeyCertificate`** *(string)*: Client Key Certificate.
  - **`rootCertificate`** *(string)*: Root Certificate.
- **`qlikCertificateValues`** *(object)*: Qlik Authentication Certificate By Values.
  - **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
