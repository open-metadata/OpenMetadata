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
- **`chartUrl`** *(string)*: Chart URL suffix from its service.
- **`tables`** *(array)*: Link to list of table fully qualified names used in this chart.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`tags`** *(array)*: Tags for this chart. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this chart. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the chart service where this chart is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
