---
title: mlmodelServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/mlmodelservicemetadatapipeline
---

# MlModelServiceMetadataPipeline

*MlModelService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/mlModelMetadataConfigType*. Default: `MlModelMetadata`.
- **`mlModelFilterPattern`**: Regex to only fetch MlModels with names matching the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`markDeletedMlModels`** *(boolean)*: Optional configuration to soft delete MlModels in OpenMetadata if the source MlModels are deleted. Also, if the MlModel is deleted, all the associated entities like lineage, etc., with that MlModels will be deleted. Default: `True`.
## Definitions

- **`mlModelMetadataConfigType`** *(string)*: MlModel Source Config Metadata Pipeline type. Must be one of: `['MlModelMetadata']`. Default: `MlModelMetadata`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
