---
title: ssisConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/ssisconnection
---

# SSISConnection

*SSIS Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/SSISType*. Default: `SSIS`.
- **`databaseConnection`**: Underlying database connection. Refer to *../database/mssqlConnection.json*.
- **`packageConnection`**: Underlying storage connection.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`SSISType`** *(string)*: Service type. Must be one of: `['SSIS']`. Default: `SSIS`.
- **`localProjectsPath`** *(string)*: Path leading to your projects.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
