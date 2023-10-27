---
title: pinotDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/pinotdbconnection
---

# PinotDBConnection

*PinotDB Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/pinotDBType](#definitions/pinotDBType)*. Default: `"PinotDB"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/pinotDBScheme](#definitions/pinotDBScheme)*. Default: `"pinot"`.
- **`username`** *(string)*: username to connect  to the PinotDB. This user should have privileges to read all the metadata in PinotDB.
- **`password`** *(string, format: password)*: password to connect  to the PinotDB.
- **`hostPort`** *(string)*: Host and port of the PinotDB service.
- **`pinotControllerHost`** *(string)*: Pinot Broker Host and Port of the data source.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
## Definitions

- <a id="definitions/pinotDBType"></a>**`pinotDBType`** *(string)*: Service type. Must be one of: `["PinotDB"]`. Default: `"PinotDB"`.
- <a id="definitions/pinotDBScheme"></a>**`pinotDBScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["pinot", "pinot+http", "pinot+https"]`. Default: `"pinot"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
