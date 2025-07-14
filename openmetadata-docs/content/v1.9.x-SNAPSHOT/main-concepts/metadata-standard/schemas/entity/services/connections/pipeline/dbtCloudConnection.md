---
title: dbt Cloud Connection | OpenMetadata dbt Cloud
description: Get started with dbtcloudconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/dbtcloudconnection
---

# DBTCloudConnection

*DBTCloud Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/DBTCloudType](#definitions/DBTCloudType)*. Default: `"DBTCloud"`.
- **`host`** *(string, format: uri)*: DBT cloud Access URL.
- **`discoveryAPI`** *(string, format: uri)*: DBT cloud Metadata API URL.
- **`accountId`** *(string)*: ID of your DBT cloud account.
- **`jobIds`** *(array)*: List of IDs of your DBT cloud jobs seperated by comma `,`.
  - **Items** *(string)*
- **`projectIds`** *(array)*: List of IDs of your DBT cloud projects seperated by comma `,`.
  - **Items** *(string)*
- **`token`** *(string, format: password)*: Generated Token to connect to DBTCloud.
## Definitions

- **`DBTCloudType`** *(string)*: Service type. Must be one of: `["DBTCloud"]`. Default: `"DBTCloud"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
