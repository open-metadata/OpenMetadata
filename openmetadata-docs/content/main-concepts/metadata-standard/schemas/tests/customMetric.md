---
title: customMetric
slug: /main-concepts/metadata-standard/schemas/tests/custommetric
---

# CustomMetric

*Custom Metric definition that we will associate with a column.*

## Properties

- **`id`**: Unique identifier of this Custom Metric instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this Custom Metric. Refer to *../type/basic.json#/definitions/entityName*.
- **`description`**: Description of the Metric. Refer to *../type/basic.json#/definitions/markdown*.
- **`columnName`** *(string)*: Name of the column in a table.
- **`expression`** *(string)*: SQL expression to compute the Metric. It should return a single numerical value.
- **`owner`**: Owner of this Custom Metric. Refer to *../type/entityReference.json*. Default: `None`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
