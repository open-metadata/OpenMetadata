---
title: prestoConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/prestoconnection
---

# PrestoConnection

*Presto Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/prestoType](#definitions/prestoType)*. Default: `"Presto"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/prestoScheme](#definitions/prestoScheme)*. Default: `"presto"`.
- **`username`** *(string)*: Username to connect to Presto. This user should have privileges to read all the metadata in Postgres.
- **`password`** *(string, format: password)*: Password to connect to Presto.
- **`hostPort`** *(string)*: Host and port of the Presto service.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`catalog`** *(string)*: Presto catalog.
- **`protocol`** *(string)*: Protocol ( Connection Argument ) to connect to Presto.
- **`verify`** *(string)*: Verify ( Connection Argument for SSL ) to connect to Presto.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsDatabase`**: Refer to *[../connectionBasicType.json#/definitions/supportsDatabase](#/connectionBasicType.json#/definitions/supportsDatabase)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
## Definitions

- **`prestoType`** *(string)*: Service type. Must be one of: `["Presto"]`. Default: `"Presto"`.
- **`prestoScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["presto"]`. Default: `"presto"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
