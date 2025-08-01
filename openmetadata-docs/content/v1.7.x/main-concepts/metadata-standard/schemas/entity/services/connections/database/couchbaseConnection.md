---
title: Couchbase Connection | OpenMetadata Couchbase
description: Get started with couchbaseconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/couchbaseconnection
---

# Couchbase Connection

*Couchbase Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/couchbaseType](#definitions/couchbaseType)*. Default: `"Couchbase"`.
- **`scheme`**: Couchbase driver scheme options. Refer to *[#/definitions/couchbaseScheme](#definitions/couchbaseScheme)*. Default: `"couchbase"`.
- **`bucket`** *(string)*: Couchbase connection Bucket options.
- **`username`** *(string)*: Username to connect to Couchbase. This user should have privileges to read all the metadata in Couchbase.
- **`password`** *(string, format: password)*: Password to connect to Couchbase.
- **`hostport`** *(string)*: Hostname of the Couchbase service.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`couchbaseType`** *(string)*: Service type. Must be one of: `["Couchbase"]`. Default: `"Couchbase"`.
- **`couchbaseScheme`** *(string)*: Couchbase driver scheme options. Must be one of: `["couchbase"]`. Default: `"couchbase"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
