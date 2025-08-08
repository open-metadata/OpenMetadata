---
title: searchIndex
slug: /main-concepts/metadata-standard/schemas/entity/data/searchindex
---

# SearchIndex

*A `SearchIndex` is a index mapping definition in ElasticSearch or OpenSearch*

## Properties

- **`id`**: Unique identifier that identifies this SearchIndex instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies the SearchIndex. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Name that uniquely identifies a SearchIndex in the format 'searchServiceName.searchIndexName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this SearchIndex. It could be title or label from the source services.
- **`description`**: Description of the SearchIndex instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`service`**: Link to the search cluster/service where this SearchIndex is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this SearchIndex is hosted in. Refer to *../services/searchService.json#/definitions/searchServiceType*.
- **`fields`** *(array)*: Fields in this SearchIndex. Default: `None`.
  - **Items**: Refer to *#/definitions/searchIndexField*.
- **`searchIndexSettings`**: Contains key/value pair of searchIndex settings. Refer to *#/definitions/searchIndexSettings*.
- **`indexType`**: Whether the entity is index or index template. Refer to *#/definitions/indexType*. Default: `Index`.
- **`sampleData`**: Sample data for a searchIndex. Refer to *#/definitions/searchIndexSampleData*. Default: `None`.
- **`owners`**: Owners of this searchIndex. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this searchIndex. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags for this searchIndex. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`domains`**: Domains the SearchIndex belongs to. When not set, the SearchIndex inherits the domain from the messaging service it belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
## Definitions

- **`searchIndexSettings`** *(object)*: Contains key/value pair of SearchIndex Settings. Can contain additional properties.
  - **Additional Properties**
- **`searchIndexSampleData`** *(object)*: This schema defines the type to capture sample data for a SearchIndex. Cannot contain additional properties.
  - **`messages`** *(array)*: List of local sample messages for a SearchIndex.
    - **Items** *(string)*
- **`indexType`** *(string)*: Whether the entity is index or index template. Must be one of: `['Index', 'IndexTemplate']`. Default: `Index`.
- **`dataType`** *(string)*: This enum defines the type of data stored in a searchIndex. Must be one of: `['NUMBER', 'TEXT', 'BINARY', 'TIMESTAMP', 'TIMESTAMPZ', 'TIME', 'DATE', 'DATETIME', 'KEYWORD', 'ARRAY', 'OBJECT', 'FLATTENED', 'NESTED', 'JOIN', 'RANGE', 'IP', 'VERSION', 'MURMUR3', 'AGGREGATE_METRIC_DOUBLE', 'HISTOGRAM', 'ANNOTATED-TEXT', 'COMPLETION', 'SEARCH_AS_YOU_TYPE', 'DENSE_VECTOR', 'RANK_FEATURE', 'RANK_FEATURES', 'GEO_POINT', 'GEO_SHAPE', 'POINT', 'SHAPE', 'PERCOLATOR', 'BOOLEAN', 'CONSTANT_KEYWORD', 'WILDCARD', 'LONG', 'INTEGER', 'SHORT', 'BYTE', 'DOUBLE', 'FLOAT', 'HALF_FLOAT', 'SCALED_FLOAT', 'UNSIGNED_LONG', 'UNKNOWN']`.
- **`searchIndexFieldName`** *(string)*: Local name (not fully qualified name) of the field. .
- **`searchIndexField`** *(object)*: This schema defines the type for a field in a searchIndex. Cannot contain additional properties.
  - **`name`**: Refer to *#/definitions/searchIndexFieldName*.
  - **`displayName`** *(string)*: Display Name that identifies this searchIndexField name.
  - **`dataType`**: Data type of the searchIndex (int, date etc.). Refer to *#/definitions/dataType*.
  - **`dataTypeDisplay`** *(string)*: Display name used for dataType. .
  - **`description`**: Description of the field. Refer to *../../type/basic.json#/definitions/markdown*.
  - **`fullyQualifiedName`**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
  - **`tags`** *(array)*: Tags associated with the column. Default: `[]`.
    - **Items**: Refer to *../../type/tagLabel.json*.
  - **`children`** *(array)*: Child columns if dataType has properties. Default: `None`.
    - **Items**: Refer to *#/definitions/searchIndexField*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
