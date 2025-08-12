---
title: dorisConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/dorisconnection
---

# DorisConnection

*Doris Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/dorisType*. Default: `Doris`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/dorisScheme*. Default: `doris`.
- **`username`** *(string)*: Username to connect to Doris. This user should have privileges to read all the metadata in Doris.
- **`password`** *(string)*: Password to connect to Doris.
- **`hostPort`** *(string)*: Host and port of the Doris service.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`sslConfig`**: SSL Configuration details. Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`dorisType`** *(string)*: Service type. Must be one of: `['Doris']`. Default: `Doris`.
- **`dorisScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['doris']`. Default: `doris`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
