---
title: bulkOperationResult
slug: /main-concepts/metadata-standard/schemas/type/bulkoperationresult
---

# BulkOperationResult

*Represents result of bulk Operation performed on entities.*

## Properties

- **`dryRun`** *(boolean)*: True if the operation has dryRun flag enabled.
- **`status`**: Refer to *basic.json#/definitions/status*.
- **`abortReason`** *(string)*: Reason why import was aborted. This is set only when the `status` field is set to `aborted`.
- **`numberOfRowsProcessed`**: Refer to *#/definitions/rowCount*.
- **`numberOfRowsPassed`**: Refer to *#/definitions/rowCount*.
- **`numberOfRowsFailed`**: Refer to *#/definitions/rowCount*.
- **`successRequest`** *(array)*: Request that can be processed successfully. Default: `None`.
  - **Items**: Refer to *#/definitions/response*.
- **`failedRequest`** *(array)*: Failure Request that can be processed successfully. Default: `None`.
  - **Items**: Refer to *#/definitions/response*.
## Definitions

- **`rowCount`** *(integer)*: Type used to indicate row count. Minimum: `0`. Default: `0`.
- **`index`** *(integer)*: Type used to indicate row number or field number. In CSV the indexes start with 1. Minimum: `1`.
- **`response`** *(object)*: Request that can be processed successfully. Cannot contain additional properties.
  - **`request`**: Request that can be processed successfully.
  - **`message`** *(string)*: Message for the request.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
