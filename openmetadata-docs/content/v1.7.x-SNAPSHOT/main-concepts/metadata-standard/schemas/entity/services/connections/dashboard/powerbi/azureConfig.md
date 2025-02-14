---
title: azureConfig
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbi/azureconfig
---

# AzureConfig

*Azure storage config for pbit files*

## Properties

- **`pbitFileConfigType`** *(string)*: pbit File Configuration type. Must be one of: `["azure"]`. Default: `"azure"`.
- **`securityConfig`**: Refer to *[../../../../../security/credentials/azureCredentials.json](#/../../../../security/credentials/azureCredentials.json)*.
- **`prefixConfig`**: Refer to *[bucketDetails.json](#cketDetails.json)*.
- **`pbitFilesExtractDir`** *(string)*: Path of the folder where the .pbit files will be unzipped and datamodel schema will be extracted. Default: `"/tmp/pbitFiles"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
