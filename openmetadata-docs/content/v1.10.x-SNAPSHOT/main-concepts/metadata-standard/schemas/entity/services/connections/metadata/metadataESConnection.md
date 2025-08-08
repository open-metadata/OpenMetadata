---
title: metadataESConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/metadataesconnection
---

# MetadataESConnection

*Metadata to ElasticSearch Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/metadataESType*. Default: `MetadataES`.
- **`entities`** *(array)*: List of entities that you need to reindex. Default: `['table', 'topic', 'dashboard', 'pipeline', 'mlmodel', 'user', 'team', 'glossaryTerm', 'tag', 'entityReportData', 'webAnalyticEntityViewReportData', 'webAnalyticUserActivityReportData', 'container', 'query']`.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: Default: `True`.
- **`runMode`**: Refer to *../../../../system/eventPublisherJob.json#/definitions/runMode*.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *../../../../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage*.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 100). Default: `100`.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`metadataESType`** *(string)*: Metadata to Elastic Search type. Must be one of: `['MetadataES']`. Default: `MetadataES`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
