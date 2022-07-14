---
title: pipelineServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataIngestion/pipelineservicemetadatapipeline
---

# PipelineServiceMetadataPipeline

*PipelineService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/pipelineMetadataConfigType*. Default: `PipelineMetadata`.
- **`includeLineage`** *(boolean)*: Optional configuration to turn off fetching lineage from pipelines. Default: `True`.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
## Definitions

- **`pipelineMetadataConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `['PipelineMetadata']`. Default: `PipelineMetadata`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
