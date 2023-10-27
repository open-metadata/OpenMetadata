---
title: function
slug: /main-concepts/metadata-standard/schemas/type/function
---

# function

*Functions used for writing SpEL expression based conditions*

## Properties

- **`name`** *(string)*: Name of the function.
- **`input`** *(string)*: Description of input taken by the function.
- **`description`** *(string)*: Description fo the function.
- **`examples`** *(array)*: Examples of the function to help users author conditions.
- **`parameterInputType`**: List of receivers to send mail to. Refer to *[#/definitions/parameterType](#definitions/parameterType)*.
- **`paramAdditionalContext`**: Refer to *[#/definitions/paramAdditionalContext](#definitions/paramAdditionalContext)*.
## Definitions

- <a id="definitions/parameterType"></a>**`parameterType`** *(string)*: Must be one of: `["NotRequired", "AllIndexElasticSearch", "SpecificIndexElasticSearch", "ReadFromParamContext"]`.
- <a id="definitions/paramAdditionalContext"></a>**`paramAdditionalContext`** *(object)*: Additional Context. Cannot contain additional properties.
  - **`data`** *(array)*: List of Entities.
    - **Items** *(string)*


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
