---
title: singleStoreConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/singlestoreconnection
---

# SingleStoreConnection

*SingleStore Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/singleStoreType](#definitions/singleStoreType)*. Default: `"SingleStore"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/singleStoreScheme](#definitions/singleStoreScheme)*. Default: `"mysql+pymysql"`.
- **`username`** *(string)*: Username to connect to SingleStore. This user should have privileges to read all the metadata in MySQL.
- **`password`** *(string, format: password)*: Password to connect to SingleStore.
- **`hostPort`** *(string)*: Host and port of the SingleStore service.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsViewLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsViewLineageExtraction](#/connectionBasicType.json#/definitions/supportsViewLineageExtraction)*.
## Definitions

- **`singleStoreType`** *(string)*: Service type. Must be one of: `["SingleStore"]`. Default: `"SingleStore"`.
- **`singleStoreScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["mysql+pymysql"]`. Default: `"mysql+pymysql"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
