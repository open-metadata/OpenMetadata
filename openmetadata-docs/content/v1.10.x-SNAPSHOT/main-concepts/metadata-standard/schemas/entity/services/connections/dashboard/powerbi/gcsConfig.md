---
title: gcsConfig
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbi/gcsconfig
---

# GCSConfig

*GCS storage config for pbit files*

## Properties

- **`pbitFileConfigType`** *(string)*: pbit File Configuration type. Must be one of: `['gcs']`. Default: `gcs`.
- **`securityConfig`**: Refer to *../../../../../security/credentials/gcpCredentials.json*.
- **`prefixConfig`**: Refer to *bucketDetails.json*.
- **`pbitFilesExtractDir`** *(string)*: Path of the folder where the .pbit files will be unzipped and datamodel schema will be extracted. Default: `/tmp/pbitFiles`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
