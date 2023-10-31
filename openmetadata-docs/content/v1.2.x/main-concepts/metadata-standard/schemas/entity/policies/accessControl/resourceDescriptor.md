---
title: resourceDescriptor
slug: /main-concepts/metadata-standard/schemas/entity/policies/accesscontrol/resourcedescriptor
---

# ResourceDescriptor

*Resource descriptor*

## Properties

- **`name`** *(string)*: Name of the resource. For entity related resources, resource name is same as the entity name. Some resources such as lineage are not entities but are resources.
- **`operations`** *(array)*: List of operations supported by the resource.
  - **Items**: Refer to *#/definitions/operation*.
## Definitions

- **`operation`** *(string)*: This schema defines all possible operations on metadata of entities in OpenMetadata. Must be one of: `['All', 'Create', 'Delete', 'ViewAll', 'ViewBasic', 'ViewUsage', 'ViewTests', 'ViewQueries', 'ViewDataProfile', 'ViewSampleData', 'EditAll', 'EditCustomFields', 'EditDataProfile', 'EditDescription', 'EditDisplayName', 'EditLineage', 'EditPolicy', 'EditOwner', 'EditQueries', 'EditReviewers', 'EditRole', 'EditSampleData', 'EditStatus', 'EditTags', 'EditTeams', 'EditTier', 'EditTests', 'EditUsage', 'EditUsers', 'EditLifeCycle', 'EditKnowledgePanel', 'EditPage']`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
