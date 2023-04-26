---
title: rule
slug: /main-concepts/metadata-standard/schemas/entity/policies/accesscontrol/rule
---

# AccessControlRule

*Describes an Access Control Rule for OpenMetadata Metadata Operations. All non-null user (subject) and entity (object) attributes are evaluated with logical AND.*

## Properties

- **`name`** *(string)*: Name for this Rule.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`entityTypeAttr`** *(string)*: Entity type that the rule should match on. Default: `None`.
- **`entityTagAttr`**: Entity tag that the rule should match on. Refer to *../../../type/tagLabel.json#/definitions/tagFQN*. Default: `None`.
- **`operation`**: Operation on the entity. Refer to *#/definitions/operation*. Default: `None`.
- **`allow`** *(boolean)*: Allow or Deny operation on the entity. Default: `False`.
- **`priority`** *(integer)*: Priority of this rule among all rules across all policies. Default: `250000`.
- **`deleted`** *(boolean)*: Is the rule soft-deleted. Default: `False`.
## Definitions

- **`operation`** *(string)*: This schema defines all possible operations on metadata of data entities. Must be one of: `['Create', 'Delete', 'ViewAll', 'ViewUsage', 'ViewTests', 'TableViewQueries', 'TableViewDataProfile', 'TableViewSampleData', 'EditAll', 'EditDescription', 'EditTags', 'EditOwner', 'EditTier', 'EditCustomFields', 'EditLineage', 'EditReviewers', 'EditTests', 'TableEditQueries', 'TableEditDataProfile', 'TableEditSampleData', 'TeamEditUsers']`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
