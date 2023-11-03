---
title: postgresConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/postgresconnection
---

# PostgresConnection

*Postgres Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/postgresType*. Default: `Postgres`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/postgresScheme*. Default: `postgresql+psycopg2`.
- **`username`** *(string)*: Username to connect to Postgres. This user should have privileges to read all the metadata in Postgres.
- **`password`** *(string)*: Password to connect to Postgres.
- **`hostPort`** *(string)*: Host and port of the Postgres service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
## Definitions

- **`postgresType`** *(string)*: Service type. Must be one of: `['Postgres']`. Default: `Postgres`.
- **`postgresScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['postgresql+psycopg2']`. Default: `postgresql+psycopg2`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
