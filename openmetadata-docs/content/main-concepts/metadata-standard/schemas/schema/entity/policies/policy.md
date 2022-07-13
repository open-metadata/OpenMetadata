---
title: policy
slug: /main-concepts/metadata-standard/schemas/schema/entity/policies
---

# Policy

*This schema defines the Policy entity. A Policy defines lifecycle or access control that needs to be applied across different Data Entities.*

## Properties

- **`id`**: Unique identifier that identifies this Policy. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that uniquely identifies this Policy. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Name that uniquely identifies a Policy. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display name for this Policy.
- **`description`**: A short description of the Policy, comprehensible to regular users. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owner`**: Owner of this Policy. Refer to *../../type/entityReference.json*. Default: `None`.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`policyType`**: Refer to *#/definitions/policyType*.
- **`enabled`** *(boolean)*: Is the policy enabled. Default: `True`.
- **`version`**: Metadata version of the Policy. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the Policy in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that led to this version of the Policy. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`rules`**: Set of rules that the policy contains. Refer to *#/definitions/rules*.
- **`location`**: Location to which a policy is applied. This field is relevant only for `lifeCycle` policies. Refer to *../../type/entityReference.json*. Default: `None`.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`policyType`** *(string)*: This schema defines the type used for describing different types of policies. Must be one of: `['AccessControl', 'Lifecycle']`.
- **`rules`** *(array)*: A set of rules associated with the Policy.
  - **Items**


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
