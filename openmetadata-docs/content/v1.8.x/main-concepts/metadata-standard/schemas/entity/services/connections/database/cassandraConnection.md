---
title: Cassandra Connection | OpenMetadata Cassandra
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/cassandraconnection
---

# CassandraConnection

*Cassandra Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/cassandraType](#definitions/cassandraType)*. Default: `"Cassandra"`.
- **`username`** *(string)*: Username to connect to Cassandra. This user should have privileges to read all the metadata in Cassandra.
- **`authType`**: Choose Auth Config Type.
  - **One of**
    - : Refer to *[./common/basicAuth.json](#common/basicAuth.json)*.
    - : Refer to *[./cassandra/cloudConfig.json](#cassandra/cloudConfig.json)*.
- **`hostPort`** *(string)*: Host and port of the Cassandra service when using the `cassandra` connection scheme. Only host when using the `cassandra+srv` scheme.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`cassandraType`** *(string)*: Service type. Must be one of: `["Cassandra"]`. Default: `"Cassandra"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
