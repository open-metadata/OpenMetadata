---
title: customDatabaseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/customdatabaseconnection
---

# CustomDatabaseConnection

*Custom Database Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom database service type. Refer to *#/definitions/customDatabaseType*. Default: `CustomDatabase`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`customDatabaseType`** *(string)*: Custom database service type. Must be one of: `['CustomDatabase']`. Default: `CustomDatabase`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
