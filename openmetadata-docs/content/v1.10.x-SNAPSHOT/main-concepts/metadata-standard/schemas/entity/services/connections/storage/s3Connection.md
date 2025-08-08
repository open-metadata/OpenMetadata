---
title: s3Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/s3connection
---

# S3 Connection

*S3 Connection.*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/s3Type*. Default: `S3`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`bucketNames`** *(array)*: Bucket Names of the data source. Default: `None`.
  - **Items** *(string)*
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`containerFilterPattern`**: Regex to only fetch containers that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['_SUCCESS']}`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`s3Type`** *(string)*: S3 service type. Must be one of: `['S3']`. Default: `S3`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
