---
title: reverseIngestionResponse
slug: /main-concepts/metadata-standard/schemas/entity/services/ingestionpipelines/reverseingestionresponse
---

# ReverseIngestionResponse

*Apply a set of operations on a service*

## Properties

- **`serviceId`**: The id of the service to be modified. Refer to *../../../type/basic.json#/definitions/uuid*.
- **`success`** *(boolean)*: Whether the workflow was successful. Failure indicates a critical failure such as connection issues.
- **`message`** *(string)*: Error message in case of failure.
- **`results`** *(array)*: List of operations to be performed on the service.
  - **Items**: Refer to *#/definitions/reverseIngestionOperationResult*.
## Definitions

- **`reverseIngestionOperationResult`** *(object)*
  - **`id`**: The id of the operation. Refer to *../../../type/basic.json#/definitions/uuid*.
  - **`success`** *(boolean)*: Whether the specific operation was successful.
  - **`message`** *(string)*: Error message in case of failure.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
