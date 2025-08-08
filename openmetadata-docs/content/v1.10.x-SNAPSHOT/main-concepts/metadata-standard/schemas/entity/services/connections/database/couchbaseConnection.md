---
title: couchbaseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/couchbaseconnection
---

# Couchbase Connection

*Couchbase Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/couchbaseType*. Default: `Couchbase`.
- **`scheme`**: Couchbase driver scheme options. Refer to *#/definitions/couchbaseScheme*. Default: `couchbase`.
- **`bucket`** *(string)*: Couchbase connection Bucket options.
- **`username`** *(string)*: Username to connect to Couchbase. This user should have privileges to read all the metadata in Couchbase.
- **`password`** *(string)*: Password to connect to Couchbase.
- **`hostport`** *(string)*: Hostname of the Couchbase service.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`couchbaseType`** *(string)*: Service type. Must be one of: `['Couchbase']`. Default: `Couchbase`.
- **`couchbaseScheme`** *(string)*: Couchbase driver scheme options. Must be one of: `['couchbase']`. Default: `couchbase`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
