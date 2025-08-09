---
title: GCS Config | OpenMetadata Google Cloud Storage Config
description: Get started with gcsconfig. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbi/gcsconfig
---

# GCSConfig

*GCS storage config for pbit files*

## Properties

- **`pbitFileConfigType`** *(string)*: pbit File Configuration type. Must be one of: `["gcs"]`. Default: `"gcs"`.
- **`securityConfig`**: Refer to *[../../../../../security/credentials/gcpCredentials.json](#/../../../../security/credentials/gcpCredentials.json)*.
- **`prefixConfig`**: Refer to *[bucketDetails.json](#cketDetails.json)*.
- **`pbitFilesExtractDir`** *(string)*: Path of the folder where the .pbit files will be unzipped and datamodel schema will be extracted. Default: `"/tmp/pbitFiles"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
