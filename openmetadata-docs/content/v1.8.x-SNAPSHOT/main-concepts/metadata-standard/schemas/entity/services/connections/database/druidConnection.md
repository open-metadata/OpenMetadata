---
title: druidConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/druidconnection
---

# DruidConnection

*Druid Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/druidType](#definitions/druidType)*. Default: `"Druid"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/druidScheme](#definitions/druidScheme)*. Default: `"druid"`.
- **`username`** *(string)*: Username to connect to Druid. This user should have privileges to read all the metadata in Druid.
- **`password`** *(string, format: password)*: Password to connect to Druid.
- **`hostPort`** *(string)*: Host and port of the Druid service.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsViewLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsViewLineageExtraction](#/connectionBasicType.json#/definitions/supportsViewLineageExtraction)*.
## Definitions

- **`druidType`** *(string)*: Service type. Must be one of: `["Druid"]`. Default: `"Druid"`.
- **`druidScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["druid"]`. Default: `"druid"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
