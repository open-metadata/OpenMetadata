---
title: Metric Schema | OpenMetadata Metric Schema and Definitions
slug: /main-concepts/metadata-standard/schemas/entity/data/metric
---

# Metric

*This schema defines the Metrics entity. `Metrics` are measurements computed from data such as `Monthly Active Users`. Some of the metrics that measures used to determine performance against an objective are called KPIs or Key Performance Indicators, such as `User Retention`.*

## Properties

- **`id`**: Unique identifier that identifies this Metric instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this Metric instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: A unique name that identifies a metric in the format 'ServiceName.MetricName'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this metric.
- **`description`**: Description of metrics instance, what it is, and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`metricExpression`**: Expression used to compute the metric. Refer to *[#/definitions/metricExpression](#definitions/metricExpression)*.
- **`metricType`**: Type of the metric. Refer to *[#/definitions/metricType](#definitions/metricType)*.
- **`unitOfMeasurement`**: Unit of measurement for the metric. Refer to *[#/definitions/unitOfMeasurement](#definitions/unitOfMeasurement)*.
- **`granularity`**: Metric's granularity. Refer to *[#/definitions/metricGranularity](#definitions/metricGranularity)*.
- **`relatedMetrics`**: Related Metrics. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owners`**: Owners of this metrics. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`followers`**: Followers of this API Collection. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`tags`** *(array)*: Tags for this chart. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`domain`**: Domain the Glossary belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`votes`**: Votes on the entity. Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`certification`**: Refer to *[../../type/assetCertification.json](#/../type/assetCertification.json)*.
## Definitions

- **`metricExpression`** *(object)*: Cannot contain additional properties.
  - **`language`** *(string)*: This schema defines the type of the language used for Metric Expression Code. Must be one of: `["SQL", "Java", "JavaScript", "Python", "External"]`.
  - **`code`** *(string)*: This schema defines the type of the language used for Metric Formula's Code.
- **`metricType`** *(string)*: This schema defines the type of Metric. Must be one of: `["COUNT", "SUM", "AVERAGE", "RATIO", "PERCENTAGE", "MIN", "MAX", "MEDIAN", "MODE", "STANDARD_DEVIATION", "VARIANCE", "OTHER"]`.
- **`unitOfMeasurement`** *(string)*: This schema defines the type of Metric's unit of measurement. Must be one of: `["COUNT", "DOLLARS", "PERCENTAGE", "TIMESTAMP", "SIZE", "REQUESTS", "EVENTS", "TRANSACTIONS"]`.
- **`metricGranularity`** *(string)*: This schema defines the type of Metric's granularity. Must be one of: `["SECOND", "MINUTE", "HOUR", "DAY", "WEEK", "MONTH", "QUARTER", "YEAR"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
