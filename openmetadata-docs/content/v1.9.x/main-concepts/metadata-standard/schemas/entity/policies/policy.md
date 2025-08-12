---
title: Policy Schema | OpenMetadata Policy Schema and Management
description: Represent policies for enforcing rules and controls over data access, ownership, and usage.
slug: /main-concepts/metadata-standard/schemas/entity/policies/policy
---

# Policy

*A `Policy` defines control that needs to be applied across different Data Entities.*

## Properties

- **`id`**: Unique identifier that identifies this Policy. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that uniquely identifies this Policy. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: Name that uniquely identifies a Policy. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display name for this Policy.
- **`description`**: A short description of the Policy, comprehensible to regular users. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this Policy. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`enabled`** *(boolean)*: Is the policy enabled. Default: `true`.
- **`version`**: Metadata version of the Policy. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the Policy in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that led to this version of the Policy. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`rules`**: Set of rules that the policy contains. Refer to *[#/definitions/rules](#definitions/rules)*.
- **`teams`**: Teams that use this policy directly and not through roles. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`roles`**: Roles that use this policy. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`location`**: Location to which a policy is applied. This field is relevant only for `lifeCycle` policies. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*. Default: `null`.
- **`allowDelete`** *(boolean)*: Some system policies can't be deleted.
- **`allowEdit`** *(boolean)*: Some system roles can't be edited.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`provider`**: Refer to *[../../type/basic.json#/definitions/providerType](#/../type/basic.json#/definitions/providerType)*.
- **`disabled`** *(boolean)*: System policy can't be deleted. Use this flag to disable them.
- **`domain`**: Domain the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`rules`** *(array)*: A set of rules associated with the Policy.
  - **Items**: Refer to *[accessControl/rule.json](#cessControl/rule.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
