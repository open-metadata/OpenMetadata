---
title: exasolConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/exasolconnection
---

# ExasolConnection

*Exasol Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/exasolType*. Default: `Exasol`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/exasolScheme*. Default: `exa+websocket`.
- **`username`** *(string)*: Username to connect to Exasol. This user should have privileges to read all the metadata in Exasol.
- **`password`** *(string)*: Password to connect to Exasol.
- **`hostPort`** *(string)*: Host and port of the source service. Default: `127.0.0.1:8563`.
- **`tls`** *(string)*: Client SSL/TLS settings. Must be one of: `['disable-tls', 'ignore-certificate', 'validate-certificate']`. Default: `validate-certificate`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
## Definitions

- **`exasolType`** *(string)*: Service type. Must be one of: `['Exasol']`. Default: `Exasol`.
- **`exasolScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['exa+websocket']`. Default: `exa+websocket`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
