---
title: redashConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/redashconnection
---

# RedashConnection

*Redash Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/redashType*. Default: `Redash`.
- **`username`** *(string)*: Username for Redash.
- **`hostPort`** *(string)*: URL for the Redash instance. Default: `http://localhost:5000`.
- **`apiKey`** *(string)*: API key of the redash instance to access.
- **`redashVersion`** *(string)*: Version of the Redash instance. Default: `10.0.0`.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`redashType`** *(string)*: Redash service type. Must be one of: `['Redash']`. Default: `Redash`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
