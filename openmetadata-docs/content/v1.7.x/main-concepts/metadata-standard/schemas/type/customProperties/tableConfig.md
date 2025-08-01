---
title: Table Config | OpenMetadata Table Config Information
description: Connect Tableconfig to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/type/customproperties/tableconfig
---

# TableConfig

*Custom property configuration for table-type property where all column data types are strings.*

## Properties

- **`columns`** *(array)*: List of column names defined at the entity type level. Length must be between 1 and 3 (inclusive).
  - **Items** *(string)*: The name of the column.
- **`minColumns`** *(integer)*: Default: `1`.
- **`maxColumns`** *(integer)*: Default: `3`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
