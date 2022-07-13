---
title: entityLineage
slug: /main-concepts/metadata-standard/schemas/schema/type
---

# Entity Lineage

*This schema defines the type used for lineage of an entity.*

## Properties

- **`entity`**: Primary entity for which this lineage graph is created. Refer to *entityReference.json*.
- **`nodes`** *(array)*: Default: `None`.
  - **Items**: Refer to *entityReference.json*.
- **`upstreamEdges`** *(array)*: Default: `None`.
  - **Items**: Refer to *#/definitions/edge*.
- **`downstreamEdges`** *(array)*: Default: `None`.
  - **Items**: Refer to *#/definitions/edge*.
## Definitions

- **`columnLineage`** *(object)*
  - **`fromColumns`** *(array)*: One or more source columns identified by fully qualified column name used by transformation function to create destination column.
    - **Items**: Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
  - **`toColumn`**: Destination column identified by fully qualified column name created by the transformation of source columns. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
  - **`function`**: Transformation function applied to source columns to create destination column. That is `function(fromColumns) -> toColumn`. Refer to *../type/basic.json#/definitions/sqlFunction*.
- **`lineageDetails`** *(object)*: Lineage details including sqlQuery + pipeline + columnLineage.
  - **`sqlQuery`**: SQL used for transformation. Refer to *../type/basic.json#/definitions/sqlQuery*.
  - **`columnsLineage`** *(array)*: Lineage information of how upstream columns were combined to get downstream column.
    - **Items**: Refer to *#/definitions/columnLineage*.
  - **`pipeline`**: Pipeline where the sqlQuery is periodically run. Refer to *../type/entityReference.json*.
- **`edge`** *(object)*: Edge in the lineage graph from one entity to another by entity IDs. Cannot contain additional properties.
  - **`fromEntity`**: From entity that is upstream of lineage edge. Refer to *basic.json#/definitions/uuid*.
  - **`toEntity`**: To entity that is downstream of lineage edge. Refer to *basic.json#/definitions/uuid*.
  - **`description`**: Refer to *basic.json#/definitions/markdown*.
  - **`lineageDetails`**: Optional lineageDetails provided only for table to table lineage edge. Refer to *#/definitions/lineageDetails*.
- **`entitiesEdge`** *(object)*: Edge in the lineage graph from one entity to another using entity references. Cannot contain additional properties.
  - **`fromEntity`**: From entity that is upstream of lineage edge. Refer to *entityReference.json*.
  - **`toEntity`**: To entity that is downstream of lineage edge. Refer to *entityReference.json*.
  - **`description`**: Refer to *basic.json#/definitions/markdown*.
  - **`lineageDetails`**: Optional lineageDetails provided only for table to table lineage edge. Refer to *#/definitions/lineageDetails*.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
