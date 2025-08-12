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

- **`operation`** *(string)*: This schema defines all possible operations on metadata of entities in OpenMetadata. Must be one of: `['All', 'Create', 'CreateIngestionPipelineAutomator', 'Delete', 'ViewAll', 'ViewBasic', 'ViewUsage', 'ViewTests', 'ViewQueries', 'ViewDataProfile', 'ViewProfilerGlobalConfiguration', 'ViewSampleData', 'ViewTestCaseFailedRowsSample', 'EditAll', 'EditCustomFields', 'EditDataProfile', 'EditDescription', 'EditDisplayName', 'EditLineage', 'EditEntityRelationship', 'EditPolicy', 'EditOwners', 'EditQueries', 'EditReviewers', 'EditRole', 'EditSampleData', 'EditStatus', 'EditTags', 'EditGlossaryTerms', 'EditTeams', 'EditTier', 'EditCertification', 'EditTests', 'EditUsage', 'EditUsers', 'EditLifeCycle', 'EditKnowledgePanel', 'EditPage', 'EditIngestionPipelineStatus', 'DeleteTestCaseFailedRowsSample', 'Deploy', 'Trigger', 'Kill', 'GenerateToken', 'EditScim', 'CreateScim', 'DeleteScim', 'ViewScim']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
