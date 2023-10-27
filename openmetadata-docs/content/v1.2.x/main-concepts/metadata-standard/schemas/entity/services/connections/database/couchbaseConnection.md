---
title: couchbaseConnection
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
## Definitions

- <a id="definitions/couchbaseType"></a>**`couchbaseType`** *(string)*: Service type. Must be one of: `["Couchbase"]`. Default: `"Couchbase"`.
- <a id="definitions/couchbaseScheme"></a>**`couchbaseScheme`** *(string)*: Couchbase driver scheme options. Must be one of: `["couchbase"]`. Default: `"couchbase"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
