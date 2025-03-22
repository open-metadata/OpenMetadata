---
title: csvFile
slug: /main-concepts/metadata-standard/schemas/type/csvfile
---

# csvFile

*Represents a CSV file.*

## Properties

- **`headers`** *(array)*
  - **Items**: Refer to *[#/definitions/csvHeader](#definitions/csvHeader)*.
- **`records`** *(array)*
  - **Items**: Refer to *[#/definitions/csvRecord](#definitions/csvRecord)*.
## Definitions

- **`csvHeader`** *(object)*: Represents a header for a field in a CSV file. Cannot contain additional properties.
  - **`name`** *(string, required)*
  - **`required`** *(boolean)*: Default: `false`.
  - **`description`**: Description of the header field for documentation purposes. Refer to *[basic.json#/definitions/markdown](#sic.json#/definitions/markdown)*.
  - **`examples`** *(array, required)*: Example values for the field.
    - **Items** *(string)*
- **`csvRecord`** *(array)*: Represents a CSV record that contains one row values separated by a separator.
  - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
