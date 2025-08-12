---
title: entityLineage | OpenMetadata Entity Lineage
description: EntityLineage schema models data flow between sources, tables, dashboards, and pipelines.
slug: /main-concepts/metadata-standard/schemas/type/entitylineage
---

# Entity Lineage

*The `Lineage` for a given data asset, has information of the input datasets used and the ETL pipeline that created it.*

## Properties

- **`entity`**: Primary entity for which this lineage graph is created. Refer to *[entityReference.json](#tityReference.json)*.
- **`nodes`** *(array)*: Default: `null`.
  - **Items**: Refer to *[entityReference.json](#tityReference.json)*.
- **`upstreamEdges`** *(array)*: Default: `null`.
  - **Items**: Refer to *[#/definitions/edge](#definitions/edge)*.
- **`downstreamEdges`** *(array)*: Default: `null`.
  - **Items**: Refer to *[#/definitions/edge](#definitions/edge)*.
## Definitions

- **`columnLineage`** *(object)*
  - **`fromColumns`** *(array)*: One or more source columns identified by fully qualified column name used by transformation function to create destination column.
    - **Items**: Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
  - **`toColumn`**: Destination column identified by fully qualified column name created by the transformation of source columns. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
  - **`function`**: Transformation function applied to source columns to create destination column. That is `function(fromColumns) -> toColumn`. Refer to *[../type/basic.json#/definitions/sqlFunction](#/type/basic.json#/definitions/sqlFunction)*.
- **`lineageDetails`** *(object)*: Lineage details including sqlQuery + pipeline + columnLineage.
  - **`sqlQuery`**: SQL used for transformation. Refer to *[../type/basic.json#/definitions/sqlQuery](#/type/basic.json#/definitions/sqlQuery)*.
  - **`columnsLineage`** *(array)*: Lineage information of how upstream columns were combined to get downstream column.
    - **Items**: Refer to *[#/definitions/columnLineage](#definitions/columnLineage)*.
  - **`pipeline`**: Pipeline where the sqlQuery is periodically run. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
  - **`description`** *(string)*: description of lineage.
  - **`source`** *(string)*: Lineage type describes how a lineage was created. Must be one of: `["Manual", "ViewLineage", "QueryLineage", "PipelineLineage", "DashboardLineage", "DbtLineage", "SparkLineage", "OpenLineage", "ExternalTableLineage", "CrossDatabaseLineage"]`. Default: `"Manual"`.
- **`edge`** *(object)*: Edge in the lineage graph from one entity to another by entity IDs. Cannot contain additional properties.
  - **`fromEntity`**: From entity that is upstream of lineage edge. Refer to *[basic.json#/definitions/uuid](#sic.json#/definitions/uuid)*.
  - **`toEntity`**: To entity that is downstream of lineage edge. Refer to *[basic.json#/definitions/uuid](#sic.json#/definitions/uuid)*.
  - **`description`**: Refer to *[basic.json#/definitions/markdown](#sic.json#/definitions/markdown)*.
  - **`lineageDetails`**: Optional lineageDetails provided only for table to table lineage edge. Refer to *[#/definitions/lineageDetails](#definitions/lineageDetails)*.
- **`entitiesEdge`** *(object)*: Edge in the lineage graph from one entity to another using entity references. Cannot contain additional properties.
  - **`fromEntity`**: From entity that is upstream of lineage edge. Refer to *[entityReference.json](#tityReference.json)*.
  - **`toEntity`**: To entity that is downstream of lineage edge. Refer to *[entityReference.json](#tityReference.json)*.
  - **`description`**: Refer to *[basic.json#/definitions/markdown](#sic.json#/definitions/markdown)*.
  - **`lineageDetails`**: Optional lineageDetails provided only for table to table lineage edge. Refer to *[#/definitions/lineageDetails](#definitions/lineageDetails)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
