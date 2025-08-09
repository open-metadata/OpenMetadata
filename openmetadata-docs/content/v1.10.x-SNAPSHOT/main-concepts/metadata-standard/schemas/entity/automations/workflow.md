---
title: workflow
slug: /main-concepts/metadata-standard/schemas/entity/automations/workflow
---

# Workflow

*A unit of work that will be triggered as an API call to the OpenMetadata server.*

## Properties

- **`id`**: Unique identifier of this workflow instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the workflow. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this workflow definition.
- **`description`**: Description of the test connection def. Refer to *../../type/basic.json#/definitions/markdown*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`workflowType`**: Type of the workflow. Refer to *#/definitions/workflowType*.
- **`status`**: Workflow computation status. Refer to *#/definitions/workflowStatus*. Default: `Pending`.
- **`request`**: Request body for a specific workflow type.
- **`response`**: Response to the request.
- **`openMetadataServerConnection`**: Refer to *../services/connections/metadata/openMetadataConnection.json*.
- **`owners`**: Owners of this workflow. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
## Definitions

- **`workflowType`** *(string)*: This enum defines the type for which this workflow applies to. Must be one of: `['TEST_CONNECTION', 'REVERSE_INGESTION']`.
- **`workflowStatus`** *(string)*: Enum defining possible Workflow status. Must be one of: `['Pending', 'Successful', 'Failed', 'Running']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
