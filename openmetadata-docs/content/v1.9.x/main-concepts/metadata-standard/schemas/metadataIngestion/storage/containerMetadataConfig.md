---
title: Containermetadataconfig | Official Documentation
description: Define schema for container metadata config used to extract and manage metadata for containerized file structures during ingestion.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/storage/containermetadataconfig
---

# StorageContainerConfig

*Definition of the properties contained by an object store container template config file*

## Properties

- **`entries`** *(array)*: List of metadata entries for the bucket containing information about where data resides and its structure. Default: `null`.
  - **Items**: Refer to *[#/definitions/metadataEntry](#definitions/metadataEntry)*.
## Definitions

- **`metadataEntry`** *(object)*: Config properties for a container found in a user-supplied metadata config.
  - **`dataPath`** *(string, required)*: The path where the data resides in the container, excluding the bucket name.
  - **`structureFormat`** *(string)*: What's the schema format for the container, eg. avro, parquet, csv. Default: `null`.
  - **`unstructuredFormats`** *(array)*: What the unstructured formats you want to ingest, eg. png, pdf, jpg. Default: `null`.
    - **Items** *(string)*
  - **`depth`** *(integer)*: Depth of the data path in the container. Default: `0`.
  - **`separator`** *(string)*: For delimited files such as CSV, what is the separator being used? Default: `null`.
  - **`isPartitioned`** *(boolean)*: Flag indicating whether the container's data is partitioned. Default: `false`.
  - **`partitionColumns`** *(array)*: What are the partition columns in case the container's data is partitioned. Default: `null`.
    - **Items**: Refer to *[../../entity/data/table.json#/definitions/column](#/../entity/data/table.json#/definitions/column)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
