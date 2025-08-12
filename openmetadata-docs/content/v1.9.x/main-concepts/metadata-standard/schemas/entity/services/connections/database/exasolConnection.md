---
title: Exasol Connection | OpenMetadata Exasol Database Connection
description: Get started with exasolconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/exasolconnection
---

# ExasolConnection

*Exasol Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/exasolType](#definitions/exasolType)*. Default: `"Exasol"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/exasolScheme](#definitions/exasolScheme)*. Default: `"exa+websocket"`.
- **`username`** *(string)*: Username to connect to Exasol. This user should have privileges to read all the metadata in Exasol.
- **`password`** *(string, format: password)*: Password to connect to Exasol.
- **`hostPort`** *(string)*: Host and port of the source service. Default: `"127.0.0.1:8563"`.
- **`tls`** *(string)*: Client SSL/TLS settings. Must be one of: `["disable-tls", "ignore-certificate", "validate-certificate"]`. Default: `"validate-certificate"`.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`exasolType`** *(string)*: Service type. Must be one of: `["Exasol"]`. Default: `"Exasol"`.
- **`exasolScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["exa+websocket"]`. Default: `"exa+websocket"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
