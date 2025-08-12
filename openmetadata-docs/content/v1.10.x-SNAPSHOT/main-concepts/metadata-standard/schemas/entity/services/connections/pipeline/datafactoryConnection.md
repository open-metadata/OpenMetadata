---
title: datafactoryConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/datafactoryconnection
---

# DataFactoryConnection

*Azure Data Factory Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/DataFactoryType*. Default: `DataFactory`.
- **`subscription_id`** *(string)*: The azure subscription identifier.
- **`resource_group_name`** *(string)*: The name of your resource group the data factory is associated with.
- **`factory_name`** *(string)*: The name of your azure data factory.
- **`run_filter_days`** *(integer)*: Number of days in the past to filter pipeline runs. Default: `7`.
- **`configSource`**: Available sources to fetch metadata. Refer to *../../../../security/credentials/azureCredentials.json*.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`DataFactoryType`** *(string)*: Service type. Must be one of: `['DataFactory']`. Default: `DataFactory`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
