---
title: createChart
slug: /main-concepts/metadata-standard/schemas/api/data/createchart
---

# CreateChartRequest

*Create Chart entity request*

## Properties

- **`name`**: Name that identifies this Chart. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Chart. It could be title or label from the source services.
- **`description`**: Description of the chart instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`chartType`**: Refer to *../../entity/data/chart.json#/definitions/chartType*.
- **`sourceUrl`**: Chart URL suffix from its service. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`tags`** *(array)*: Tags for this chart. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this chart. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`service`**: Link to the chart service where this chart is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Chart belongs to.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`dashboards`** *(array)*: List of fully qualified name of dashboards containing this Chart. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
