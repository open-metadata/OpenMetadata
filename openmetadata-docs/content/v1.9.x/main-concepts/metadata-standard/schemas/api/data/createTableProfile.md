---
title: Create Table Profile | OpenMetadata Table Profile API
description: Create a profile for a table including column-level metrics, data distributions, null counts, and profiling run details.
slug: /main-concepts/metadata-standard/schemas/api/data/createtableprofile
---

# CreateTableProfileRequest

*Schema corresponding to a table profile that belongs to a table*

## Properties

- **`tableProfile`**: Table Profile. Refer to *[../../entity/data/table.json#/definitions/tableProfile](#/../entity/data/table.json#/definitions/tableProfile)*.
- **`columnProfile`** *(array)*: List of local column profiles of the table.
  - **Items**: Refer to *[../../entity/data/table.json#/definitions/columnProfile](#/../entity/data/table.json#/definitions/columnProfile)*.
- **`systemProfile`** *(array)*: List of system profiles for the table.
  - **Items**: Refer to *[../../entity/data/table.json#/definitions/systemProfile](#/../entity/data/table.json#/definitions/systemProfile)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
