---
title: containerMetadataConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/storage/containermetadataconfig
---

# StorageContainerConfig

*Definition of the properties contained by an object store container template config file*

## Properties

- **`entries`** *(array)*: List of metadata entries for the bucket containing information about where data resides and its structure. Default: `None`.
  - **Items**: Refer to *#/definitions/metadataEntry*.
## Definitions

- **`metadataEntry`** *(object)*: Config properties for a container found in a user-supplied metadata config.
  - **`dataPath`** *(string)*: The path where the data resides in the container, excluding the bucket name.
  - **`structureFormat`** *(string)*: What's the schema format for the container, e.g. avro, parquet, csv. Default: `None`.
  - **`isPartitioned`** *(boolean)*: Flag indicating whether the container's data is partitioned. Default: `False`.
  - **`partitionColumns`** *(array)*: What are the partition columns in case the container's data is partitioned. Default: `None`.
    - **Items**: Refer to *../../entity/data/table.json#/definitions/column*.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
