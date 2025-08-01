---
title: validationResponse | OpenMetadata Validation Response
description: Connect Validationresponse to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/system/validationresponse
---

# SystemValidationResponse

*Define the system validation response*

## Properties

- **`database`**: Database connectivity check. Refer to *[#/definitions/stepValidation](#definitions/stepValidation)*.
- **`searchInstance`**: Search instance connectivity check. Refer to *[#/definitions/stepValidation](#definitions/stepValidation)*.
- **`pipelineServiceClient`**: Pipeline Service Client connectivity check. Refer to *[#/definitions/stepValidation](#definitions/stepValidation)*.
- **`jwks`**: JWKs validation. Refer to *[#/definitions/stepValidation](#definitions/stepValidation)*.
- **`migrations`**: List migration results. Refer to *[#/definitions/stepValidation](#definitions/stepValidation)*.
## Definitions

- **`stepValidation`** *(object)*: Cannot contain additional properties.
  - **`description`** *(string)*: Validation description. What is being tested?
  - **`passed`** *(boolean)*: Did the step validation successfully?
  - **`message`** *(string)*: Results or exceptions to be shared after running the test. Default: `null`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
