---
title: redshiftConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/redshiftconnection
---

# RedshiftConnection

*Redshift  Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/redshiftType*. Default: `Redshift`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/redshiftScheme*. Default: `redshift+psycopg2`.
- **`username`** *(string)*: Username to connect to Redshift. This user should have privileges to read all the metadata in Redshift.
- **`password`** *(string)*: Password to connect to Redshift.
- **`hostPort`** *(string)*: Host and port of the Redshift service.
- **`database`** *(string)*: Initial Redshift database to connect to. If you want to ingest all databases, set ingestAllDatabases to true.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Redshift. You can use databaseFilterPattern on top of this. Default: `False`.
- **`sslMode`**: SSL Mode to connect to redshift database. Must be one of: `['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']`. Default: `disable`.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`redshiftType`** *(string)*: Service type. Must be one of: `['Redshift']`. Default: `Redshift`.
- **`redshiftScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['redshift+psycopg2']`. Default: `redshift+psycopg2`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
