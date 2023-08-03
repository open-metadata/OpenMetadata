---
title: csvFile
slug: /main-concepts/metadata-standard/schemas/type/csvfile
---

# csvFile

*Represents a CSV file.*

## Properties

- **`headers`** *(array)*
  - **Items**: Refer to *#/definitions/csvHeader*.
- **`records`** *(array)*
  - **Items**: Refer to *#/definitions/csvRecord*.
## Definitions

- **`csvHeader`** *(object)*: Represents a header for a field in a CSV file. Cannot contain additional properties.
  - **`name`** *(string)*
  - **`required`** *(boolean)*: Default: `False`.
  - **`description`**: Description of the header field for documentation purposes. Refer to *basic.json#/definitions/markdown*.
  - **`examples`** *(array)*: Example values for the field.
    - **Items** *(string)*
- **`csvRecord`** *(array)*: Represents a CSV record that contains one row values separated by a separator.
  - **Items** *(string)*


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
