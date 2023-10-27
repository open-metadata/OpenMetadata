---
title: db2Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/db2connection
---

# Db2Connection

*Db2 Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/db2Type](#definitions/db2Type)*. Default: `"Db2"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/db2Scheme](#definitions/db2Scheme)*. Default: `"db2+ibm_db"`.
- **`username`** *(string)*: Username to connect to DB2. This user should have privileges to read all the metadata in DB2.
- **`password`** *(string, format: password)*: Password to connect to DB2.
- **`hostPort`** *(string)*: Host and port of the DB2 service.
- **`database`** *(string)*: Database of the data source.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsDatabase`**: Refer to *[../connectionBasicType.json#/definitions/supportsDatabase](#/connectionBasicType.json#/definitions/supportsDatabase)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
## Definitions

- <a id="definitions/db2Type"></a>**`db2Type`** *(string)*: Service type. Must be one of: `["Db2"]`. Default: `"Db2"`.
- <a id="definitions/db2Scheme"></a>**`db2Scheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["db2+ibm_db"]`. Default: `"db2+ibm_db"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
