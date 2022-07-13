---
title: metadataESConnection
slug: /main-concepts/metadata-standard/schemas/schema/entity/services/connections/metadata
---

# MetadataESConnection

*Metadata to ElasticSearch Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/metadataESType*. Default: `MetadataES`.
- **`includeTopics`** *(boolean)*: Include Topics for Indexing. Default: `true`.
- **`includeTables`** *(boolean)*: Include Tables for Indexing. Default: `true`.
- **`includeDashboards`** *(boolean)*: Include Dashboards for Indexing. Default: `true`.
- **`includePipelines`** *(boolean)*: Include Pipelines for Indexing. Default: `true`.
- **`includeMlModels`** *(boolean)*: Include MlModels for Indexing. Default: `true`.
- **`includeUsers`** *(boolean)*: Include Users for Indexing. Default: `true`.
- **`includeTeams`** *(boolean)*: Include Teams for Indexing. Default: `true`.
- **`includeGlossaryTerms`** *(boolean)*: Include Glossary Terms for Indexing. Default: `true`.
- **`includePolicy`** *(boolean)*: Include Tags for Policy. Default: `True`.
- **`includeMessagingServices`** *(boolean)*: Include Messaging Services for Indexing. Default: `True`.
- **`includeDatabaseServices`** *(boolean)*: Include Database Services for Indexing. Default: `True`.
- **`includePipelineServices`** *(boolean)*: Include Pipeline Services for Indexing. Default: `True`.
- **`includeTags`** *(boolean)*: Include Tags for Indexing. Default: `True`.
- **`limitRecords`** *(integer)*: Limit the number of records for Indexing. Default: `1000`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`metadataESType`** *(string)*: Metadata to Elastic Search type. Must be one of: `['MetadataES']`. Default: `MetadataES`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
