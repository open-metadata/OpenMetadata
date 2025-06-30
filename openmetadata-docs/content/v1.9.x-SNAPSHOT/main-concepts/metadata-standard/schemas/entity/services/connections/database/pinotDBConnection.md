---
title: PinotDB Connection | OpenMetadata PinotDB
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/pinotdbconnection
---

# PinotDBConnection

*PinotDB Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/pinotDBType](#definitions/pinotDBType)*. Default: `"PinotDB"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/pinotDBScheme](#definitions/pinotDBScheme)*. Default: `"pinot"`.
- **`username`** *(string)*: username to connect to the PinotDB. This user should have privileges to read all the metadata in PinotDB.
- **`password`** *(string, format: password)*: password to connect to the PinotDB.
- **`hostPort`** *(string)*: Host and port of the PinotDB Broker service.
- **`pinotControllerHost`** *(string)*: Pinot Controller Host and Port of the data source.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsViewLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsViewLineageExtraction](#/connectionBasicType.json#/definitions/supportsViewLineageExtraction)*.
## Definitions

- **`pinotDBType`** *(string)*: Service type. Must be one of: `["PinotDB"]`. Default: `"PinotDB"`.
- **`pinotDBScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["pinot", "pinot+http", "pinot+https"]`. Default: `"pinot"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
