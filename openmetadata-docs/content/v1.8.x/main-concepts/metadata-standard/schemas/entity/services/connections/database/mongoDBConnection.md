---
title: mongoDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mongodbconnection
---

# MongoDBConnection

*MongoDB Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/mongoDBType](#definitions/mongoDBType)*. Default: `"MongoDB"`.
- **`scheme`**: Mongo connection scheme options. Refer to *[#/definitions/mongoDBScheme](#definitions/mongoDBScheme)*. Default: `"mongodb"`.
- **`username`** *(string)*: Username to connect to MongoDB. This user should have privileges to read all the metadata in MongoDB.
- **`password`** *(string, format: password)*: Password to connect to MongoDB.
- **`hostPort`** *(string)*: Host and port of the MongoDB service when using the `mongodb` connection scheme. Only host when using the `mongodb+srv` scheme.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`sslMode`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslMode)*.
- **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
## Definitions

- **`mongoDBType`** *(string)*: Service type. Must be one of: `["MongoDB"]`. Default: `"MongoDB"`.
- **`mongoDBScheme`** *(string)*: Mongo connection scheme options. Must be one of: `["mongodb", "mongodb+srv"]`. Default: `"mongodb"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
