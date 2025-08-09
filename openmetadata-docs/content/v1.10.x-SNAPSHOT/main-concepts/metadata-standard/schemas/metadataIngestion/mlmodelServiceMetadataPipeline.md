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
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `False`.
## Definitions

- **`mlModelMetadataConfigType`** *(string)*: MlModel Source Config Metadata Pipeline type. Must be one of: `['MlModelMetadata']`. Default: `MlModelMetadata`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
