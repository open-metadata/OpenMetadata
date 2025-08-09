---
title: gcsConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/gcsconnection
---

# GCS Connection

*GCS Connection.*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/gcsType*. Default: `GCS`.
- **`credentials`**: GCP Credentials. Refer to *../../../../security/credentials/gcpCredentials.json*.
- **`bucketNames`** *(array)*: Bucket Names of the data source. Default: `None`.
  - **Items** *(string)*
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`containerFilterPattern`**: Regex to only fetch containers that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`gcsType`** *(string)*: Gcs service type. Must be one of: `['GCS']`. Default: `GCS`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
