---
title: createQueryCostRecord
slug: /main-concepts/metadata-standard/schemas/api/data/createquerycostrecord
---

# CreateQueryCostRecordRequest

*CreateQuery Cost Record*

## Properties

- **`timestamp`**: Timestamp on which the failure was created. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`jsonSchema`** *(string)*: Json schema of the query.
- **`queryReference`**: Query entity reference. Refer to *../../type/entityReference.json*.
- **`cost`** *(number)*: Avg query cost per execution.
- **`count`** *(number)*: Number of times the query was executed.
- **`totalDuration`** *(number)*: Total duration of the query. Default: `0`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
