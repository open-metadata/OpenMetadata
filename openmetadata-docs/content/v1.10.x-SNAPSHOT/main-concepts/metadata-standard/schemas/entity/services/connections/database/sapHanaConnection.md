---
title: sapHanaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/saphanaconnection
---

# SapHanaConnection

*Sap Hana Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/sapHanaType*. Default: `SapHana`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/sapHanaScheme*. Default: `hana`.
- **`connection`**: Choose between Database connection or HDB User Store connection.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsDataDiff`**: Refer to *../connectionBasicType.json#/definitions/supportsDataDiff*.
## Definitions

- **`sapHanaType`** *(string)*: Service type. Must be one of: `['SapHana']`. Default: `SapHana`.
- **`sapHanaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['hana']`. Default: `hana`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
