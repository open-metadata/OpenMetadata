---
title: Role | OpenMetadata Role API and Permissions
slug: /main-concepts/metadata-standard/schemas/entity/teams/role
---

# Role

*A `Role` is a collection of `Policies` that provides access control. A user or a team can be assigned one or multiple roles that provide privileges to a user and members of a team to perform the job function.*

## Properties

- **`id`**: Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Data Consumer'.
- **`description`**: Description of the role. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`allowDelete`** *(boolean)*: Some system roles can't be deleted.
- **`allowEdit`** *(boolean)*: Some system roles can't be edited.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`policies`**: Policies that is attached to this role. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`users`**: Users that have this role assigned to them. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`teams`**: Teams that have this role assigned to them. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`provider`**: Refer to *[../../type/basic.json#/definitions/providerType](#/../type/basic.json#/definitions/providerType)*.
- **`disabled`** *(boolean)*: System policy can't be deleted. Use this flag to disable them.
- **`domain`**: Domain the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions



Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
