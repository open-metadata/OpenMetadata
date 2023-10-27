---
title: createPolicy
slug: /main-concepts/metadata-standard/schemas/api/policies/createpolicy
---

# CreatePolicyRequest

*Create Policy Entity Request*

## Properties

- **`name`**: Name that identifies this Policy. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Title for this Policy.
- **`description`**: A short description of the Policy, comprehensible to regular users. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owner`**: Owner of this Policy. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`rules`**: Refer to *[../../entity/policies/policy.json#/definitions/rules](#/../entity/policies/policy.json#/definitions/rules)*.
- **`enabled`** *(boolean)*: Is the policy enabled. Default: `true`.
- **`location`**: UUID of Location where this policy is applied. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*. Default: `null`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
