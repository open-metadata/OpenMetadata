---
title: filterPattern
slug: /main-concepts/metadata-standard/schemas/type/filterpattern
---

# FilterPatternModel

*OpenMetadata Ingestion Framework definition.*

## Definitions

- **`filterPattern`** *(object)*: Regex to only fetch dashboards or charts that matches the pattern. Cannot contain additional properties.
  - **`includes`** *(array)*: List of strings/regex patterns to match and include only database entities that match. Default: `None`.
    - **Items** *(string)*
  - **`excludes`** *(array)*: List of strings/regex patterns to match and exclude only database entities that match. Default: `None`.
    - **Items** *(string)*


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
