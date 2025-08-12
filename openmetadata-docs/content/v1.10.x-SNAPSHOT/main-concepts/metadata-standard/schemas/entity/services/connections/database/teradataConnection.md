---
title: teradataConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/teradataconnection
---

# TeradataConnection

*Teradata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/teradataType*. Default: `Teradata`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/teradataScheme*. Default: `teradatasql`.
- **`username`** *(string)*: Username to connect to Teradata. This user should have privileges to read all the metadata in Teradata.
- **`password`** *(string)*: Password to connect to Teradata.
- **`logmech`** *(string)*: Specifies the logon authentication method. Possible values are TD2 (the default), JWT, LDAP, KRB5 for Kerberos, or TDNEGO. Must be one of: `['TD2', 'LDAP', 'JWT', 'KRB5', 'CUSTOM', 'TDNEGO']`. Default: `TD2`.
- **`logdata`** *(string)*: Specifies additional data needed by a logon mechanism, such as a secure token, Distinguished Name, or a domain/realm name. LOGDATA values are specific to each logon mechanism.
- **`hostPort`** *(string)*: Host and port of the Teradata service.
- **`tmode`** *(string)*: Specifies the transaction mode for the connection. Must be one of: `['ANSI', 'TERA', 'DEFAULT']`. Default: `DEFAULT`.
- **`account`** *(string)*: Specifies an account string to override the default account string defined for the database user. Accounts are used by the database for workload management and resource usage monitoring.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsViewLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsViewLineageExtraction*.
## Definitions

- **`teradataType`** *(string)*: Service type. Must be one of: `['Teradata']`. Default: `Teradata`.
- **`teradataScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['teradatasql']`. Default: `teradatasql`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
