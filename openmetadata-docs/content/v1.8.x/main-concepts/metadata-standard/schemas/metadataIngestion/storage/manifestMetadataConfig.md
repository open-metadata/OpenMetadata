---
title: manifestMetadataConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/storage/manifestmetadataconfig
---

# ManifestMetadataConfig

*Definition of the manifest file containing entries to be ingested across multiple buckets as object storage entries*

## Properties

- **`entries`** *(array)*: List of metadata entries for the bucket containing information about where data resides and its structure. Default: `null`.
  - **Items**: Refer to *[#/definitions/manifestMetadataEntry](#definitions/manifestMetadataEntry)*.
## Definitions

- **`manifestMetadataEntry`** *(object)*: Config properties for a container found in a user-supplied metadata config.
  - **`containerName`** *(string, required)*: The top-level container name containing the data path to be ingested.
  - **`dataPath`** *(string, required)*: The path where the data resides in the container, excluding the bucket name.
  - **`structureFormat`** *(string)*: What's the schema format for the container, eg. avro, parquet, csv. Default: `null`.
  - **`separator`** *(string)*: For delimited files such as CSV, what is the separator being used? Default: `null`.
  - **`isPartitioned`** *(boolean)*: Flag indicating whether the container's data is partitioned. Default: `false`.
  - **`partitionColumns`** *(array)*: What are the partition columns in case the container's data is partitioned. Default: `null`.
    - **Items**: Refer to *[../../entity/data/table.json#/definitions/column](#/../entity/data/table.json#/definitions/column)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
