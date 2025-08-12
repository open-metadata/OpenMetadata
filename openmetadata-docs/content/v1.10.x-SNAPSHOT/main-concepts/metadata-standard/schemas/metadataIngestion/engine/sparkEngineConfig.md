---
title: sparkEngineConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/engine/sparkengineconfig
---

# Spark Engine Configuration

*This schema defines the configuration for a Spark Engine runner.*

## Properties

- **`type`** *(string)*: Must be one of: `['Spark']`. Default: `Spark`.
- **`remote`** *(string)*: Spark Connect Remote URL.
- **`config`** *(object)*
  - **`tempPath`** *(string)*: Temporary path to store the data. Default: `/tmp/openmetadata`.
  - **`extraConfig`**: Additional Spark configuration properties as key-value pairs. Refer to *../../type/basic.json#/definitions/map*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
