---
title: createPolicy
slug: /main-concepts/metadata-standard/schemas/api/policies/createpolicy
---

# CreatePolicyRequest

*Create Policy Entity Request*

## Properties

- **`name`**: Name that identifies this Policy. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Title for this Policy.
- **`description`**: A short description of the Policy, comprehensible to regular users. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owner`**: Owner of this Policy. Refer to *../../type/entityReference.json*.
- **`policyType`**: Refer to *../../entity/policies/policy.json#/definitions/policyType*.
- **`rules`**: Refer to *../../entity/policies/policy.json#/definitions/rules*.
- **`enabled`** *(boolean)*: Is the policy enabled. Default: `True`.
- **`location`**: UUID of Location where this policy is applied. Refer to *../../type/basic.json#/definitions/uuid*. Default: `None`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
