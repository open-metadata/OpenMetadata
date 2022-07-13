---
title: databricksConnection
slug: /main-concepts/metadata-standard/schemas/schema/entity/services/connections/database
---

# DatabricksConnection

*Databricks Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/databricksType*. Default: `Databricks`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/databricksScheme*. Default: `databricks+connector`.
- **`username`** *(string)*: Username to connect to Databricks. This user should have privileges to read all the metadata in Databricks.
- **`password`** *(string)*: Password to connect to Databricks.
- **`hostPort`** *(string)*: Host and port of the Databricks service.
- **`token`** *(string)*: Generated Token to connect to Databricks.
- **`httpPath`** *(string)*: Databricks compute resources URL.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`databricksType`** *(string)*: Service type. Must be one of: `['Databricks']`. Default: `Databricks`.
- **`databricksScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['databricks+connector']`. Default: `databricks+connector`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
