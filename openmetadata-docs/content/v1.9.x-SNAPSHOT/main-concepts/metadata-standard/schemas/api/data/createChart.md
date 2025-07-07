---
title: Create Chart API | OpenMetadata Chart API
slug: /main-concepts/metadata-standard/schemas/api/data/createchart
---

# CreateChartRequest

*Create Chart entity request*

## Properties

- **`name`**: Name that identifies this Chart. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Chart. It could be title or label from the source services.
- **`description`**: Description of the chart instance. What it has and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`chartType`**: Refer to *[../../entity/data/chart.json#/definitions/chartType](#/../entity/data/chart.json#/definitions/chartType)*.
- **`sourceUrl`**: Chart URL suffix from its service. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`tags`** *(array)*: Tags for this chart. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this chart. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`service`**: Link to the chart service where this chart is hosted in. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`**: Fully qualified name of the domain the Chart belongs to. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`dashboards`** *(array)*: List of fully qualified name of dashboards containing this Chart. Default: `null`.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
