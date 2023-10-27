---
title: metadataESConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/metadataesconnection
---

# MetadataESConnection

*Metadata to ElasticSearch Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/metadataESType](#definitions/metadataESType)*. Default: `"MetadataES"`.
- **`entities`** *(array)*: List of entities that you need to reindex. Default: `["table", "topic", "dashboard", "pipeline", "mlmodel", "user", "team", "glossaryTerm", "tag", "entityReportData", "webAnalyticEntityViewReportData", "webAnalyticUserActivityReportData", "container", "query"]`.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: Default: `true`.
- **`runMode`**: Refer to *[../../../../system/eventPublisherJob.json#/definitions/runMode](#/../../../system/eventPublisherJob.json#/definitions/runMode)*.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *[../../../../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage](#/../../../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage)*.
- **`batchSize`** *(integer)*: Maximum number of events sentx in a batch (Default 10). Default: `100`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/metadataESType"></a>**`metadataESType`** *(string)*: Metadata to Elastic Search type. Must be one of: `["MetadataES"]`. Default: `"MetadataES"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
