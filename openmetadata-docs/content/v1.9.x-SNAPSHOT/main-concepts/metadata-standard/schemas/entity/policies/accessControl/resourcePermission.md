---
title: Resource Permission | OpenMetadata Resource Permissions
description: Learn how to configure resource permissions in OpenMetadata's access control system. Define granular user access rights for data assets and metadata.
slug: /main-concepts/metadata-standard/schemas/entity/policies/accesscontrol/resourcepermission
---

# ResourcePermission

*A set of permissions for a user that shows what operation is denied, allowed, or not allowed for all the resources.*

## Properties

- **`resource`** *(string)*: Name of the resource.
- **`permissions`** *(array)*: Permissions for a `resource`.
  - **Items**: Refer to *[#/definitions/permission](#definitions/permission)*.
## Definitions

- **`permission`** *(object)*: Cannot contain additional properties.
  - **`operation`**: Operation names related to the `resource`. Refer to *[resourceDescriptor.json#/definitions/operation](#sourceDescriptor.json#/definitions/operation)*.
  - **`access`** *(string)*: Access decided after evaluating rules in a policy. Note the access is defined in the order of precedence. Must be one of: `["deny", "allow", "conditionalDeny", "conditionalAllow", "notAllow"]`.
  - **`rule`**: Rule that matches the resource and the operation that decided the `access` as `allow` or `deny`. When no rule matches, the `access` is set to `notAllow`. When access can't be determined because all information required to match the `condition` in the rule, `access` is set to `conditional`. Refer to *[rule.json](#le.json)*.
  - **`policy`** *(string)*: Name of the policy where the `rule` is from.
  - **`role`** *(string)*: Name of the role where the `policy` is from. If this is not role based policy, `role` is set to null.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
