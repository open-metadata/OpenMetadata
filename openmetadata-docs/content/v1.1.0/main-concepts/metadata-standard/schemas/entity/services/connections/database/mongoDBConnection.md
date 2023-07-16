---
title: mongoDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mongodbconnection
---

# MongoDBConnection

*MongoDB Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/mongoDBType*. Default: `MongoDB`.
- **`connectionDetails`**: MongoDB Connection Details.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`mongoDBType`** *(string)*: Service type. Must be one of: `['MongoDB']`. Default: `MongoDB`.
- **`MongoConnectionString`** *(object)*
  - **`connectionURI`** *(string)*: Connection URI to connect to your MongoDB cluster.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
