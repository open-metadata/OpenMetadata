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
- **`owner`**: Owner of this chart. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the chart service where this chart is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domain`**: Fully qualified name of the domain the Chart belongs to. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
