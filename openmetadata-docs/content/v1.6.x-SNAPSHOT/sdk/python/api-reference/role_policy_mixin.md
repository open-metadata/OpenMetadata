---
title: Role Policy Mixin
slug: /sdk/python/api-reference/role-policy-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/role_policy_mixin.py#L0")

# module `role_policy_mixin`
Mixin class containing Role and Policy specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/role_policy_mixin.py#L39")

## class `OMetaRolePolicyMixin`
OpenMetadata API methods related to Roles and Policies. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/utils/deprecation.py#L269")

### method `patch_policy_rule`

```python
patch_policy_rule(
    entity_id: Union[str, Uuid],
    rule: Optional[Rule] = None,
    operation: Union[ForwardRef(<ADD: 'add'>), ForwardRef(<REMOVE: 'remove'>)] = <PatchOperation.ADD: 'add'>
) → Optional[Policy]
```

Given a Policy ID, JSON PATCH the rule (add or remove). 

Args  entity_id: ID of the role to be patched  rule: The rule to add or remove  operation: The operation to perform, either "add" or "remove" Returns  Updated Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/utils/deprecation.py#L133")

### method `patch_role_policy`

```python
patch_role_policy(
    entity_id: Union[str, Uuid],
    policy_id: Union[str, Uuid],
    operation: Union[ForwardRef(<ADD: 'add'>), ForwardRef(<REMOVE: 'remove'>)] = <PatchOperation.ADD: 'add'>
) → Optional[Role]
```

Given a Role ID, JSON PATCH the policies. 

Args  entity_id: ID of the role to be patched  policy_id: ID of the policy to be added or removed  operation: Operation to be performed. Either 'add' or 'remove' Returns  Updated Entity 




---


