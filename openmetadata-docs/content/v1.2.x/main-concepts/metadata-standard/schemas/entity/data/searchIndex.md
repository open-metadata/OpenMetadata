---
title: searchIndex
slug: /main-concepts/metadata-standard/schemas/entity/data/searchindex
---

# SearchIndex

*A `SearchIndex` is a index mapping definition in ElasticSearch or OpenSearch*

## Properties

- **`id`**: Unique identifier that identifies this SearchIndex instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies the SearchIndex. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: Name that uniquely identifies a SearchIndex in the format 'searchServiceName.searchIndexName'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this SearchIndex. It could be title or label from the source services.
- **`description`**: Description of the SearchIndex instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`service`**: Link to the search cluster/service where this SearchIndex is hosted in. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`serviceType`**: Service type where this SearchIndex is hosted in. Refer to *[../services/searchService.json#/definitions/searchServiceType](#/services/searchService.json#/definitions/searchServiceType)*.
- **`fields`** *(array)*: Fields in this SearchIndex. Default: `null`.
  - **Items**: Refer to *[#/definitions/searchIndexField](#definitions/searchIndexField)*.
- **`searchIndexSettings`**: Contains key/value pair of searchIndex settings. Refer to *[#/definitions/searchIndexSettings](#definitions/searchIndexSettings)*.
- **`sampleData`**: Sample data for a searchIndex. Refer to *[#/definitions/searchIndexSampleData](#definitions/searchIndexSampleData)*. Default: `null`.
- **`owner`**: Owner of this searchIndex. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`followers`**: Followers of this searchIndex. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`tags`** *(array)*: Tags for this searchIndex. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`domain`**: Domain the SearchIndex belongs to. When not set, the SearchIndex inherits the domain from the messaging service it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`votes`**: Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
## Definitions

- <a id="definitions/searchIndexSettings"></a>**`searchIndexSettings`** *(object)*: Contains key/value pair of SearchIndex Settings. Can contain additional properties.
  - **Additional Properties**
- <a id="definitions/searchIndexSampleData"></a>**`searchIndexSampleData`** *(object)*: This schema defines the type to capture sample data for a SearchIndex. Cannot contain additional properties.
  - **`messages`** *(array)*: List of local sample messages for a SearchIndex.
    - **Items** *(string)*
- <a id="definitions/dataType"></a>**`dataType`** *(string)*: This enum defines the type of data stored in a searchIndex. Must be one of: `["NUMBER", "TEXT", "BINARY", "TIMESTAMP", "TIMESTAMPZ", "TIME", "DATE", "DATETIME", "KEYWORD", "ARRAY", "OBJECT", "FLATTENED", "NESTED", "JOIN", "RANGE", "IP", "VERSION", "MURMUR3", "AGGREGATE_METRIC_DOUBLE", "HISTOGRAM", "ANNOTATED-TEXT", "COMPLETION", "SEARCH_AS_YOU_TYPE", "DENSE_VECTOR", "RANK_FEATURE", "RANK_FEATURES", "GEO_POINT", "GEO_SHAPE", "POINT", "SHAPE", "PERCOLATOR", "UNKNOWN"]`.
- <a id="definitions/searchIndexFieldName"></a>**`searchIndexFieldName`** *(string)*: Local name (not fully qualified name) of the field. .
- <a id="definitions/searchIndexField"></a>**`searchIndexField`** *(object)*: This schema defines the type for a field in a searchIndex. Cannot contain additional properties.
  - **`name`**: Refer to *[#/definitions/searchIndexFieldName](#definitions/searchIndexFieldName)*.
  - **`displayName`** *(string)*: Display Name that identifies this searchIndexField name.
  - **`dataType`**: Data type of the searchIndex (int, date etc.). Refer to *[#/definitions/dataType](#definitions/dataType)*.
  - **`dataTypeDisplay`** *(string)*: Display name used for dataType. .
  - **`description`**: Description of the field. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
  - **`fullyQualifiedName`**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
  - **`tags`** *(array)*: Tags associated with the column. Default: `null`.
    - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
  - **`children`** *(array)*: Child columns if dataType has properties. Default: `null`.
    - **Items**: Refer to *[#/definitions/searchIndexField](#definitions/searchIndexField)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
