---
title: Doris Connection | OpenMetadata Doris Database Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/dorisconnection
---

# DorisConnection

*Doris Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/dorisType](#definitions/dorisType)*. Default: `"Doris"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/dorisScheme](#definitions/dorisScheme)*. Default: `"doris"`.
- **`username`** *(string)*: Username to connect to Doris. This user should have privileges to read all the metadata in Doris.
- **`password`** *(string, format: password)*: Password to connect to Doris.
- **`hostPort`** *(string)*: Host and port of the Doris service.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`sslConfig`**: SSL Configuration details. Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
## Definitions

- **`dorisType`** *(string)*: Service type. Must be one of: `["Doris"]`. Default: `"Doris"`.
- **`dorisScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["doris"]`. Default: `"doris"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
