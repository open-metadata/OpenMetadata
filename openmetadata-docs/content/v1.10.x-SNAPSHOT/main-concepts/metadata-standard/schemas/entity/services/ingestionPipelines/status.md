---
title: status
slug: /main-concepts/metadata-standard/schemas/entity/services/ingestionpipelines/status
---

# IngestionStatusModel

*Ingestion detailed status*

## Definitions

- **`stackTraceError`** *(object)*: Represents a failure status. Cannot contain additional properties.
  - **`name`** *(string)*: Name of the asset with the error.
  - **`error`** *(string)*: Error being handled.
  - **`stackTrace`** *(string)*: Exception stack trace.
- **`stepSummary`** *(object)*: Defines the summary status of each step executed in an Ingestion Pipeline. Cannot contain additional properties.
  - **`name`** *(string)*: Step name.
  - **`records`** *(integer)*: Number of successfully processed records. Default: `0`.
  - **`updated_records`** *(integer)*: Number of successfully updated records. Default: `0`.
  - **`warnings`** *(integer)*: Number of records raising warnings. Default: `0`.
  - **`errors`** *(integer)*: Number of records with errors. Default: `0`.
  - **`filtered`** *(integer)*: Number of filtered records. Default: `0`.
  - **`failures`** *(array)*: Sample of errors encountered in the step.
    - **Items**: Refer to *#/definitions/stackTraceError*.
- **`ingestionStatus`** *(array)*: Summary for each step of the ingestion pipeline.
  - **Items**: Refer to *#/definitions/stepSummary*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
