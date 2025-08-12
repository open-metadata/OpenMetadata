---
title: dbtCloudConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/dbtcloudconnection
---

# DBTCloudConnection

*DBTCloud Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/DBTCloudType*. Default: `DBTCloud`.
- **`host`** *(string)*: DBT cloud Access URL.
- **`discoveryAPI`** *(string)*: DBT cloud Metadata API URL.
- **`accountId`** *(string)*: ID of your DBT cloud account.
- **`jobIds`** *(array)*: List of IDs of your DBT cloud jobs seperated by comma `,`.
  - **Items** *(string)*
- **`projectIds`** *(array)*: List of IDs of your DBT cloud projects seperated by comma `,`.
  - **Items** *(string)*
- **`numberOfRuns`** *(integer)*: Number of runs to fetch from DBT cloud. Default: `100`.
- **`token`** *(string)*: Generated Token to connect to DBTCloud.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`DBTCloudType`** *(string)*: Service type. Must be one of: `['DBTCloud']`. Default: `DBTCloud`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
