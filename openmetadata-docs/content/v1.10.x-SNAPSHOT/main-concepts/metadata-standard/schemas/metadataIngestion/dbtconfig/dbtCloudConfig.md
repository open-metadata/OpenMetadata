---
title: dbtCloudConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtconfig/dbtcloudconfig
---

# DBT Cloud Config

*dbt Cloud configuration.*

## Properties

- **`dbtConfigType`** *(string)*: dbt Configuration type. Must be one of: `['cloud']`. Default: `cloud`.
- **`dbtCloudAuthToken`** *(string)*: dbt cloud account authentication token.
- **`dbtCloudAccountId`** *(string)*: dbt cloud account Id.
- **`dbtCloudProjectId`** *(string)*: In case of multiple projects in a dbt cloud account, specify the project's id from which you want to extract the dbt run artifacts.
- **`dbtCloudJobId`** *(string)*: dbt cloud job id.
- **`dbtCloudUrl`** *(string)*: URL to connect to your dbt cloud instance. E.g., https://cloud.getdbt.com or https://emea.dbt.com/. Default: `https://cloud.getdbt.com`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
