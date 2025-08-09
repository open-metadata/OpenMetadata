---
title: complexTypes
slug: /main-concepts/metadata-standard/schemas/type/customproperties/complextypes
---

# JSON Schema

*This schema defines custom properties complex types.*

## Properties

- **`table-cp`**: Refer to *#/definitions/table-cp*.
## Definitions

- **`entityReference`**: Entity Reference for Custom Property.
  - **`id`** *(string)*: Unique identifier that identifies an entity instance.
  - **`type`** *(string)*: Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`, `dashboardService`...
  - **`name`** *(string)*: Name of the entity instance.
  - **`fullyQualifiedName`** *(string)*: Fully qualified name of the entity instance. For entities such as tables, databases fullyQualifiedName is returned in this field. For entities that don't have name hierarchy such as `user` and `team` this will be same as the `name` field.
  - **`description`** *(string)*: Optional description of entity.
  - **`displayName`** *(string)*: Display Name that identifies this entity.
  - **`deleted`** *(boolean)*: If true the entity referred to has been soft-deleted.
  - **`inherited`** *(boolean)*: If true the relationship indicated by this entity reference is inherited from the parent entity.
  - **`href`** *(string)*: Link to the entity resource.
- **`entityReferenceList`** *(array)*: Entity Reference List for Custom Property.
  - **`items`** *(object)*
    - **`id`** *(string)*: Unique identifier that identifies an entity instance.
    - **`type`** *(string)*: Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`, `dashboardService`...
    - **`name`** *(string)*: Name of the entity instance.
    - **`fullyQualifiedName`** *(string)*: Fully qualified name of the entity instance. For entities such as tables, databases fullyQualifiedName is returned in this field. For entities that don't have name hierarchy such as `user` and `team` this will be same as the `name` field.
    - **`description`** *(string)*: Optional description of entity.
    - **`displayName`** *(string)*: Display Name that identifies this entity.
    - **`deleted`** *(boolean)*: If true the entity referred to has been soft-deleted.
    - **`inherited`** *(boolean)*: If true the relationship indicated by this entity reference is inherited from the parent entity.
    - **`href`** *(string)*: Link to the entity resource.
- **`table-cp`** *(object)*: A table-type custom property having rows and columns where all column data types are strings. Cannot contain additional properties.
  - **`columns`** *(array)*: List of column names defined at the entity type level.
    - **Items** *(string)*: The name of the column.
  - **`rows`** *(array)*: List of rows added at the entity instance level. Each row contains dynamic fields based on the defined columns.
    - **Items** *(object)*: A row in the table, with dynamic key-value pairs corresponding to columns. Can contain additional properties.
      - **Additional Properties** *(string)*: The cell value of each column in the row.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
