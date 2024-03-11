---
title: manifestMetadataConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/storage/manifestmetadataconfig
---

# ManifestMetadataConfig

*Definition of the manifest file containing entries to be ingested across multiple buckets as object storage entries*

## Properties

- **`entries`** *(array)*: List of metadata entries for the bucket containing information about where data resides and its structure. Default: `None`.
  - **Items**: Refer to *#/definitions/manifestMetadataEntry*.
## Definitions

- **`manifestMetadataEntry`** *(object)*: Config properties for a container found in a user-supplied metadata config.
  - **`containerName`** *(string)*: The top-level container name containing the data path to be ingested.
  - **`dataPath`** *(string)*: The path where the data resides in the container, excluding the bucket name.
  - **`structureFormat`** *(string)*: What's the schema format for the container, eg. avro, parquet, csv. Default: `None`.
  - **`isPartitioned`** *(boolean)*: Flag indicating whether the container's data is partitioned. Default: `False`.
  - **`partitionColumns`** *(array)*: What are the partition columns in case the container's data is partitioned. Default: `None`.
    - **Items**: Refer to *../../entity/data/table.json#/definitions/column*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
