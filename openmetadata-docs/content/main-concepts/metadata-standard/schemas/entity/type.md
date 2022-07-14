---
title: type
slug: /main-concepts/metadata-standard/schemas/entity/type
---

# Type

*This schema defines a type as an entity. Types includes property types and entity types. Custom types can also be defined by the users to extend the metadata system.*

## Properties

- **`id`**: Unique identifier of the type instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Unique name that identifies the type. Refer to *#/definitions/typeName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this type.
- **`description`**: Optional description of entity. Refer to *../type/basic.json#/definitions/markdown*.
- **`category`**: Refer to *#/definitions/category*.
- **`nameSpace`** *(string)*: Namespace or group to which this type belongs to. For example, some of the property types commonly used can come from `basic` namespace. Some of the entities such as `table`, `database`, etc. come from `data` namespace. Default: `custom`.
- **`schema`**: JSON schema encoded as string that defines the type. This will be used to validate the type values. Refer to *../type/basic.json#/definitions/jsonSchema*.
- **`customProperties`** *(array)*: Custom properties added to extend the entity. Only available for entity type.
  - **Items**: Refer to *#/definitions/customProperty*.
- **`version`**: Metadata version of the entity. Refer to *../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to this table resource. Refer to *../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../type/entityHistory.json#/definitions/changeDescription*.
## Definitions

- **`category`** *(string)*: Metadata category to which a type belongs to. Must be one of: `['field', 'entity']`.
- **`propertyName`** *(string)*: Name of the entity property. Note a property name must be unique for an entity. Property name must follow camelCase naming adopted by openMetadata - must start with lower case with no space, underscore, or dots.
- **`typeName`** *(string)*: Name of the property or entity types. Note a property name must be unique for an entity. Property name must follow camelCase naming adopted by openMetadata - must start with lower case with no space, underscore, or dots.
- **`customProperty`** *(object)*: Type used for adding custom property to an entity to extend it. Cannot contain additional properties.
  - **`name`**: Name of the entity property. Note a property name must be unique for an entity. Property name must follow camelCase naming adopted by openMetadata - must start with lower case with no space, underscore, or dots. Refer to *#/definitions/propertyName*.
  - **`description`**: Refer to *../type/basic.json#/definitions/markdown*.
  - **`propertyType`**: Reference to a property type. Only property types are allowed and entity types are not allowed as custom properties to extend an existing entity. Refer to *../type/entityReference.json*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
