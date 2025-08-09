---
title: createCustomMetric
slug: /main-concepts/metadata-standard/schemas/api/tests/createcustommetric
---

# CreateCustomMetricRequest

*Custom Metric definition that we will associate with a column.*

## Properties

- **`description`**: Description of the custom metric. Refer to *../../type/basic.json#/definitions/markdown*.
- **`name`**: Name that identifies this Custom Metric. Refer to *../../type/basic.json#/definitions/entityName*.
- **`columnName`** *(string)*: Name of the column in a table.
- **`expression`** *(string)*: SQL expression to compute the Metric. It should return a single numerical value.
- **`owners`**: Owners of this Pipeline. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
