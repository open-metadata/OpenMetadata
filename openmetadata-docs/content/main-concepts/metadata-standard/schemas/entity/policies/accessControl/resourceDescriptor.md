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

- **`operation`** *(string)*: This schema defines all possible operations on metadata of entities in OpenMetadata. Must be one of: `['All', 'Create', 'Delete', 'ViewAll', 'ViewBasic', 'ViewUsage', 'ViewTests', 'ViewQueries', 'ViewDataProfile', 'ViewSampleData', 'EditAll', 'EditDescription', 'EditDisplayName', 'EditTags', 'EditOwner', 'EditTier', 'EditCustomFields', 'EditLineage', 'EditStatus', 'EditReviewers', 'EditTests', 'EditQueries', 'EditDataProfile', 'EditSampleData', 'EditUsers']`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
