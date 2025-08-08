---
title: mongoDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mongodbconnection
---

# MongoDBConnection

*MongoDB Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/mongoDBType*. Default: `MongoDB`.
- **`scheme`**: Mongo connection scheme options. Refer to *#/definitions/mongoDBScheme*. Default: `mongodb`.
- **`username`** *(string)*: Username to connect to MongoDB. This user should have privileges to read all the metadata in MongoDB.
- **`password`** *(string)*: Password to connect to MongoDB.
- **`hostPort`** *(string)*: Host and port of the MongoDB service when using the `mongodb` connection scheme. Only host when using the `mongodb+srv` scheme.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`sslMode`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode*.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
## Definitions

- **`mongoDBType`** *(string)*: Service type. Must be one of: `['MongoDB']`. Default: `MongoDB`.
- **`mongoDBScheme`** *(string)*: Mongo connection scheme options. Must be one of: `['mongodb', 'mongodb+srv']`. Default: `mongodb`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
