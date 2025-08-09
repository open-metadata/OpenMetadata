---
title: setEntityCertificationTask
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/automatedtask/setentitycertificationtask
---

# SetEntityCertificationTaskDefinition

*Sets the Entity Certification to the configured value.*

## Properties

- **`type`** *(string)*: Default: `automatedTask`.
- **`subType`** *(string)*: Default: `setEntityCertificationTask`.
- **`name`**: Name that identifies this Node. Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *../../../../../type/basic.json#/definitions/markdown*.
- **`config`**: Refer to *#/definitions/certificationConfiguration*.
- **`input`** *(array)*: Default: `['relatedEntity', 'updatedBy']`.
  - **Items** *(string)*
- **`inputNamespaceMap`** *(object)*: Cannot contain additional properties.
  - **`relatedEntity`** *(string)*: Default: `global`.
  - **`updatedBy`** *(string)*: Default: `None`.
## Definitions

- **`certificationEnum`** *(string)*: Must be one of: `['', 'Certification.Gold', 'Certification.Silver', 'Certification.Bronze']`.
- **`certificationConfiguration`** *(object)*: Cannot contain additional properties.
  - **`certification`**: Choose which Certification to apply to the Data Asset. Refer to *#/definitions/certificationEnum*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
