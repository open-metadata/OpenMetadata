---
title: Type | OpenMetadata Entity Type Schema Details
slug: /main-concepts/metadata-standard/schemas/entity/type
---

# Type

*This schema defines a type as an entity. Types includes property types and entity types. Custom types can also be defined by the users to extend the metadata system.*

## Properties

- **`id`**: Unique identifier of the type instance. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`name`**: Unique name that identifies the type. Refer to *[#/definitions/entityName](#definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this type.
- **`description`**: Optional description of entity. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`category`**: Refer to *[#/definitions/category](#definitions/category)*.
- **`nameSpace`** *(string)*: Namespace or group to which this type belongs to. For example, some of the property types commonly used can come from `basic` namespace. Some of the entities such as `table`, `database`, etc. come from `data` namespace. Default: `"custom"`.
- **`schema`**: JSON schema encoded as string that defines the type. This will be used to validate the type values. Refer to *[../type/basic.json#/definitions/jsonSchema](#/type/basic.json#/definitions/jsonSchema)*.
- **`customProperties`** *(array)*: Custom properties added to extend the entity. Only available for entity type.
  - **Items**: Refer to *[../type/customProperty.json](#/type/customProperty.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../type/entityHistory.json#/definitions/entityVersion](#/type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to this table resource. Refer to *[../type/basic.json#/definitions/href](#/type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../type/entityHistory.json#/definitions/changeDescription](#/type/entityHistory.json#/definitions/changeDescription)*.
- **`domain`**: Domain the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*.
## Definitions

- **`entityName`** *(string)*: Name of the property or entity types. Note a property name must be unique for an entity. Property name must follow camelCase naming adopted by openMetadata - must start with lower case with no space, underscore, or dots.
- **`category`** *(string)*: Metadata category to which a type belongs to. Must be one of: `["field", "entity"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
