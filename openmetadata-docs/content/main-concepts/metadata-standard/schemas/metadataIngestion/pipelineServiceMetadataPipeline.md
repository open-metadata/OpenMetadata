---
title: pipelineServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/pipelineservicemetadatapipeline
---

# PipelineServiceMetadataPipeline

*PipelineService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/pipelineMetadataConfigType*. Default: `PipelineMetadata`.
- **`includeLineage`** *(boolean)*: Optional configuration to turn off fetching lineage from pipelines. Default: `True`.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
## Definitions

- **`pipelineMetadataConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `['PipelineMetadata']`. Default: `PipelineMetadata`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
