---
title: Create Policy API | OpenMetadata Policy Creation
description: Create a policy that defines access rules, resource conditions, and enforcement actions across metadata assets.
slug: /main-concepts/metadata-standard/schemas/api/policies/createpolicy
---

# CreatePolicyRequest

*Create Policy Entity Request*

## Properties

- **`name`**: Name that identifies this Policy. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Title for this Policy.
- **`description`**: A short description of the Policy, comprehensible to regular users. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this Policy. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`rules`**: Refer to *[../../entity/policies/policy.json#/definitions/rules](#/../entity/policies/policy.json#/definitions/rules)*.
- **`enabled`** *(boolean)*: Is the policy enabled. Default: `true`.
- **`location`**: UUID of Location where this policy is applied. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*. Default: `null`.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
