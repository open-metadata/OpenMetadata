---
title: sapHanaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/saphanaconnection
---

# SapHanaConnection

*Sap Hana Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/sapHanaType*. Default: `SapHana`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/sapHanaScheme*. Default: `hana`.
- **`connection`**: Choose between Database connection or HDB User Store connection.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`sapHanaType`** *(string)*: Service type. Must be one of: `['SapHana']`. Default: `SapHana`.
- **`sapHanaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['hana']`. Default: `hana`.
- **`sqlConnection`** *(object)*: Options to connect to SAP Hana by passing the database information. Cannot contain additional properties.
  - **`hostPort`** *(string)*: Host and port of the Hana service.
  - **`username`** *(string)*: Username to connect to Hana. This user should have privileges to read all the metadata.
  - **`password`** *(string)*: Password to connect to Hana.
  - **`databaseSchema`** *(string)*: Database Schema of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
  - **`database`** *(string)*: Database of the data source.
- **`hdbUserStoreConnection`** *(object)*: Use HDB User Store to avoid entering connection-related information manually. This store needs to be present on the client running the ingestion. Cannot contain additional properties.
  - **`userKey`** *(string)*: HDB Store User Key generated from the command `hdbuserstore SET <KEY> <host:port> <USERNAME> <PASSWORD>`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
