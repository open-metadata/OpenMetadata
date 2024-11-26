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
## Definitions

- **`customDatabaseType`** *(string)*: Custom database service type. Must be one of: `['CustomDatabase']`. Default: `CustomDatabase`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
