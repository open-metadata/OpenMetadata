---
title: createMetric
slug: /main-concepts/metadata-standard/schemas/api/data/createmetric
---

# CreateMetricRequest

*Create Metric entity request*

## Properties

- **`name`**: Name that identifies this metric. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this metric.
- **`description`**: Description of the metric instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`metricExpression`**: Expression used to compute the metric. Refer to *../../entity/data/metric.json#/definitions/metricExpression*.
- **`metricType`**: Type of the metric. Refer to *../../entity/data/metric.json#/definitions/metricType*.
- **`unitOfMeasurement`**: Unit of measurement for the metric. Refer to *../../entity/data/metric.json#/definitions/unitOfMeasurement*.
- **`granularity`**: Metric's granularity. Refer to *../../entity/data/metric.json#/definitions/metricGranularity*.
- **`relatedMetrics`** *(array)*: Other array of related metric fully qualified names that are related to this Metric.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`owners`**: Owners of this metric. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this metric. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`domains`** *(array)*: Fully qualified names of the domains the Metric belongs to.
  - **Items** *(string)*
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
