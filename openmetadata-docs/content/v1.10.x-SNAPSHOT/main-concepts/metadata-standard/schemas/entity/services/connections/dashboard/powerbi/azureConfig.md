---
title: azureConfig
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbi/azureconfig
---

# AzureConfig

*Azure storage config for pbit files*

## Properties

- **`pbitFileConfigType`** *(string)*: pbit File Configuration type. Must be one of: `['azure']`. Default: `azure`.
- **`securityConfig`**: Refer to *../../../../../security/credentials/azureCredentials.json*.
- **`prefixConfig`**: Refer to *bucketDetails.json*.
- **`pbitFilesExtractDir`** *(string)*: Path of the folder where the .pbit files will be unzipped and datamodel schema will be extracted. Default: `/tmp/pbitFiles`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
