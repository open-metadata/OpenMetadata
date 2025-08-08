---
title: BigTable Connection | OpenMetadata BigTable
description: Bigtable connection schema to support ingestion of NoSQL metadata from Google Cloud Bigtable.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/bigtableconnection
---

# BigTableConnection

*Google BigTable Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/bigtableType](#definitions/bigtableType)*. Default: `"BigTable"`.
- **`credentials`**: GCP Credentials. Refer to *[../../../../security/credentials/gcpCredentials.json](#/../../../security/credentials/gcpCredentials.json)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDatabase`**: Refer to *[../connectionBasicType.json#/definitions/supportsDatabase](#/connectionBasicType.json#/definitions/supportsDatabase)*.
## Definitions

- **`bigtableType`** *(string)*: Service type. Must be one of: `["BigTable"]`. Default: `"BigTable"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
