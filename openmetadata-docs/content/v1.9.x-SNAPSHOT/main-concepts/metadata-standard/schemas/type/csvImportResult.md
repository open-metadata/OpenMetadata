---
title: csvImportResult | OpenMetadata CSV Import Result
slug: /main-concepts/metadata-standard/schemas/type/csvimportresult
---

# csvImportResult

*Represents result of importing a CSV file. Detailed error is provided on if the CSV file is conformant and failure to load any of the records in the CSV file.*

## Properties

- **`dryRun`** *(boolean)*: True if the CSV import has dryRun flag enabled.
- **`status`**: Refer to *[basic.json#/definitions/status](#sic.json#/definitions/status)*.
- **`abortReason`** *(string)*: Reason why import was aborted. This is set only when the `status` field is set to `aborted`.
- **`numberOfRowsProcessed`**: Refer to *[#/definitions/rowCount](#definitions/rowCount)*.
- **`numberOfRowsPassed`**: Refer to *[#/definitions/rowCount](#definitions/rowCount)*.
- **`numberOfRowsFailed`**: Refer to *[#/definitions/rowCount](#definitions/rowCount)*.
- **`importResultsCsv`** *(string)*: CSV file that captures the result of import operation.
## Definitions

- **`rowCount`** *(integer, format: int64)*: Type used to indicate row count. Minimum: `0`. Default: `0`.
- **`index`** *(integer, format: int64)*: Type used to indicate row number or field number. In CSV the indexes start with 1. Minimum: `1`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
