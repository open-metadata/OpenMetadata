---
title: datafactoryConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/datafactoryconnection
---

# DataFactoryConnection

*Azure Data Factory Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/DataFactoryType](#definitions/DataFactoryType)*. Default: `"DataFactory"`.
- **`subscription_id`** *(string)*: The azure subscription identifier.
- **`resource_group_name`** *(string)*: The name of your resource group the data factory is associated with.
- **`factory_name`** *(string)*: The name of your azure data factory.
- **`run_filter_days`** *(integer)*: Number of days in the past to filter pipeline runs. Default: `7`.
- **`configSource`**: Available sources to fetch metadata. Refer to *[../../../../security/credentials/azureCredentials.json](#/../../../security/credentials/azureCredentials.json)*.
## Definitions

- **`DataFactoryType`** *(string)*: Service type. Must be one of: `["DataFactory"]`. Default: `"DataFactory"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
