---
title: queryCostRecord
slug: /main-concepts/metadata-standard/schemas/entity/data/querycostrecord
---

# QueryCostRecord

*Query Cost Record*

## Properties

- **`id`**: Unique identifier of this failure instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`timestamp`**: Timestamp on which the failure was created. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`jsonSchema`** *(string)*: Json schema of the query.
- **`queryReference`**: Query entity reference. Refer to *../../type/entityReference.json*.
- **`cost`** *(number)*: Avg query cost per execution.
- **`updatedBy`**: User who updated the query cost record. Refer to *../../type/entityReference.json*. Default: `None`.
- **`updatedAt`**: Time when query cost record was updated. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`count`** *(number)*: Number of times the query was executed.
- **`totalDuration`** *(number)*: Total duration of the query. Default: `0`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
