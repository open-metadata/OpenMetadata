---
title: mongoDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mongodbconnection
---

# MongoDBConnection

*MongoDB Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/mongoDBType](#definitions/mongoDBType)*. Default: `"MongoDB"`.
- **`connectionDetails`**: MongoDB Connection Details.
  - **One of**
    - : Refer to *[mongoDB/mongoDBValues.json](#ngoDB/mongoDBValues.json)*.
    - : Refer to *[#/definitions/MongoConnectionString](#definitions/MongoConnectionString)*.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/mongoDBType"></a>**`mongoDBType`** *(string)*: Service type. Must be one of: `["MongoDB"]`. Default: `"MongoDB"`.
- <a id="definitions/MongoConnectionString"></a>**`MongoConnectionString`** *(object)*
  - **`connectionURI`** *(string)*: Connection URI to connect to your MongoDB cluster.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
