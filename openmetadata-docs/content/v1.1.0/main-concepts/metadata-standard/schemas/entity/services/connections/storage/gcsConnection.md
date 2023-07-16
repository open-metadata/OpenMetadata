---
title: gcsConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/gcsconnection
---

# GCS Connection

*GCS Connection.*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/gcsType](#definitions/gcsType)*. Default: `"Gcs"`.
- **`credentials`**: GCP Credentials. Refer to *[../../../../security/credentials/gcpCredentials.json](#/../../../security/credentials/gcpCredentials.json)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/gcsType"></a>**`gcsType`** *(string)*: Gcs service type. Must be one of: `["Gcs"]`. Default: `"Gcs"`.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
