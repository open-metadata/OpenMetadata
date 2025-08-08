---
title: qlikCloudConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/qlikcloudconnection
---

# QlikCloudConnection

*Qlik Cloud Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/qlikCloudType*. Default: `QlikCloud`.
- **`token`** *(string)*: token to connect to Qlik Cloud.
- **`hostPort`** *(string)*: Host and Port of the Qlik Cloud instance.
- **`spaceTypes`** *(array)*: Space types of Qlik Cloud to filter the dashboards ingested into the platform. Default: `['Managed', 'Shared', 'Personal', 'Data']`.
  - **Items** *(string)*: Must be one of: `['Managed', 'Shared', 'Personal', 'Data']`.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`qlikCloudType`** *(string)*: Qlik Cloud service type. Must be one of: `['QlikCloud']`. Default: `QlikCloud`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
