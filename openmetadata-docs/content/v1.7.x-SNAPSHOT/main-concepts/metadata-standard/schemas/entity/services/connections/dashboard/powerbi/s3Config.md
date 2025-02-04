---
title: s3Config
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbi/s3config
---

# S3Config

*S3 storage config for pbit files*

## Properties

- **`pbitFileConfigType`** *(string)*: pbit File Configuration type. Must be one of: `["s3"]`. Default: `"s3"`.
- **`securityConfig`**: Refer to *[../../../../../security/credentials/awsCredentials.json](#/../../../../security/credentials/awsCredentials.json)*.
- **`prefixConfig`**: Refer to *[bucketDetails.json](#cketDetails.json)*.
- **`pbitFilesExtractDir`** *(string)*: Path of the folder where the .pbit files will be unzipped and datamodel schema will be extracted. Default: `"/tmp/pbitFiles"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
