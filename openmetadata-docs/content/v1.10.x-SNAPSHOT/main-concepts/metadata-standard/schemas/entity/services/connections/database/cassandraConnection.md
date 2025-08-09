---
title: cassandraConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/cassandraconnection
---

# CassandraConnection

*Cassandra Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/cassandraType*. Default: `Cassandra`.
- **`username`** *(string)*: Username to connect to Cassandra. This user should have privileges to read all the metadata in Cassandra.
- **`authType`**: Choose Auth Config Type.
- **`hostPort`** *(string)*: Host and port of the Cassandra service when using the `cassandra` connection scheme. Only host when using the `cassandra+srv` scheme.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`sslMode`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode*.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`cassandraType`** *(string)*: Service type. Must be one of: `['Cassandra']`. Default: `Cassandra`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
