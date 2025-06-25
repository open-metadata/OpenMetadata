---
title: s3Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/s3connection
---

# S3 Connection

*S3 Connection.*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/s3Type](#definitions/s3Type)*. Default: `"S3"`.
- **`awsConfig`**: Refer to *[../../../../security/credentials/awsCredentials.json](#/../../../security/credentials/awsCredentials.json)*.
- **`bucketNames`** *(array)*: Bucket Names of the data source. Default: `null`.
  - **Items** *(string)*
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`s3Type`** *(string)*: S3 service type. Must be one of: `["S3"]`. Default: `"S3"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
