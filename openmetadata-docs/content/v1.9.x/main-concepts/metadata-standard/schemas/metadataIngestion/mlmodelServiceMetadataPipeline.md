---
title: mlmodelServiceMetadataPipeline | Official Documentation
description: Connect Mlmodelservicemetadatapipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/mlmodelservicemetadatapipeline
---

# MlModelServiceMetadataPipeline

*MlModelService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/mlModelMetadataConfigType](#definitions/mlModelMetadataConfigType)*. Default: `"MlModelMetadata"`.
- **`mlModelFilterPattern`**: Regex to only fetch MlModels with names matching the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`markDeletedMlModels`** *(boolean)*: Optional configuration to soft delete MlModels in OpenMetadata if the source MlModels are deleted. Also, if the MlModel is deleted, all the associated entities like lineage, etc., with that MlModels will be deleted. Default: `true`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `false`.
## Definitions

- **`mlModelMetadataConfigType`** *(string)*: MlModel Source Config Metadata Pipeline type. Must be one of: `["MlModelMetadata"]`. Default: `"MlModelMetadata"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
