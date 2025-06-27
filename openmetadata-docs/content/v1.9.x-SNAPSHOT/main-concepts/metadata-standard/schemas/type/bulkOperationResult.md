---
title: bulkOperationResult | OpenMetadata Bulk Operation Result
slug: /main-concepts/metadata-standard/schemas/type/bulkoperationresult
---

# BulkOperationResult

*Represents result of bulk Operation performed on entities.*

## Properties

- **`dryRun`** *(boolean)*: True if the operation has dryRun flag enabled.
- **`status`**: Refer to *[basic.json#/definitions/status](#sic.json#/definitions/status)*.
- **`abortReason`** *(string)*: Reason why import was aborted. This is set only when the `status` field is set to `aborted`.
- **`numberOfRowsProcessed`**: Refer to *[#/definitions/rowCount](#definitions/rowCount)*.
- **`numberOfRowsPassed`**: Refer to *[#/definitions/rowCount](#definitions/rowCount)*.
- **`numberOfRowsFailed`**: Refer to *[#/definitions/rowCount](#definitions/rowCount)*.
- **`successRequest`** *(array)*: Request that can be processed successfully. Default: `null`.
  - **Items**: Refer to *[#/definitions/response](#definitions/response)*.
- **`failedRequest`** *(array)*: Failure Request that can be processed successfully. Default: `null`.
  - **Items**: Refer to *[#/definitions/response](#definitions/response)*.
## Definitions

- **`rowCount`** *(integer, format: int64)*: Type used to indicate row count. Minimum: `0`. Default: `0`.
- **`index`** *(integer, format: int64)*: Type used to indicate row number or field number. In CSV the indexes start with 1. Minimum: `1`.
- **`response`** *(object)*: Request that can be processed successfully. Cannot contain additional properties.
  - **`request`**: Request that can be processed successfully.
  - **`message`** *(string)*: Message for the request.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
