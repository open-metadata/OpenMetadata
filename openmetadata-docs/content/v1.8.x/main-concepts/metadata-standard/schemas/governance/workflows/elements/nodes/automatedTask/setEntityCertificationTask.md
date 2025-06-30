---
title: setEntityCertificationTask
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/automatedtask/setentitycertificationtask
---

# SetEntityCertificationTaskDefinition

*Sets the Entity Certification to the configured value.*

## Properties

- **`type`** *(string)*: Default: `"automatedTask"`.
- **`subType`** *(string)*: Default: `"setEntityCertificationTask"`.
- **`name`**: Name that identifies this Node. Refer to *[../../../../../type/basic.json#/definitions/entityName](#/../../../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *[../../../../../type/basic.json#/definitions/markdown](#/../../../../type/basic.json#/definitions/markdown)*.
- **`config`**: Refer to *[#/definitions/certificationConfiguration](#definitions/certificationConfiguration)*.
- **`input`** *(array)*: Length must be equal to 1. Default: `["relatedEntity"]`.
  - **Items** *(string)*
## Definitions

- **`certificationEnum`** *(string)*: Must be one of: `["", "Certification.Gold", "Certification.Silver", "Certification.Bronze"]`.
- **`certificationConfiguration`** *(object)*: Cannot contain additional properties.
  - **`certification`**: Refer to *[#/definitions/certificationEnum](#definitions/certificationEnum)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
