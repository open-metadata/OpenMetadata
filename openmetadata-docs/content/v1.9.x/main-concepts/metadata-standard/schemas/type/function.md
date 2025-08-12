---
title: Function Schema | OpenMetadata Function Schema Details
description: Function type schema representing executable scripts, logic units, or custom transformations on metadata.
slug: /main-concepts/metadata-standard/schemas/type/function
---

# function

*Functions used for writing SpEL expression based conditions*

## Properties

- **`name`** *(string)*: Name of the function.
- **`input`** *(string)*: Description of input taken by the function.
- **`description`** *(string)*: Description for the function.
- **`examples`** *(array)*: Examples of the function to help users author conditions.
- **`parameterInputType`**: List of receivers to send mail to. Refer to *[#/definitions/parameterType](#definitions/parameterType)*.
- **`paramAdditionalContext`**: Refer to *[#/definitions/paramAdditionalContext](#definitions/paramAdditionalContext)*.
## Definitions

- **`parameterType`** *(string)*: Must be one of: `["NotRequired", "AllIndexElasticSearch", "SpecificIndexElasticSearch", "ReadFromParamContext", "ReadFromParamContextPerEntity"]`.
- **`paramAdditionalContext`** *(object)*: Additional Context. Cannot contain additional properties.
  - **`data`**: List of Entities.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
