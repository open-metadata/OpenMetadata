---
title: mlmodelServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/mlmodelservicemetadatapipeline
---

# MlModelServiceMetadataPipeline

*MlModelService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/mlModelMetadataConfigType*. Default: `MlModelMetadata`.
- **`mlModelFilterPattern`**: Regex to only fetch MlModels with names matching the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
## Definitions

- **`mlModelMetadataConfigType`** *(string)*: MlModel Source Config Metadata Pipeline type. Must be one of: `['MlModelMetadata']`. Default: `MlModelMetadata`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
