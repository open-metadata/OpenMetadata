---
title: validationResponse
slug: /main-concepts/metadata-standard/schemas/system/validationresponse
---

# SystemValidationResponse

*Define the system validation response*

## Properties

- **`database`**: Database connectivity check. Refer to *#/definitions/stepValidation*.
- **`searchInstance`**: Search instance connectivity check. Refer to *#/definitions/stepValidation*.
- **`pipelineServiceClient`**: Pipeline Service Client connectivity check. Refer to *#/definitions/stepValidation*.
- **`jwks`**: JWKs validation. Refer to *#/definitions/stepValidation*.
- **`migrations`**: List migration results. Refer to *#/definitions/stepValidation*.
## Definitions

- **`stepValidation`** *(object)*: Cannot contain additional properties.
  - **`description`** *(string)*: Validation description. What is being tested?
  - **`passed`** *(boolean)*: Did the step validation successfully?
  - **`message`** *(string)*: Results or exceptions to be shared after running the test. Default: `None`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
