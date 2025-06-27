---
title: customProperty | OpenMetadata Custom Property
slug: /main-concepts/metadata-standard/schemas/type/customproperty
---

# CustomProperty

*This schema defines the custom property to an entity to extend it.*

## Properties

- **`name`**: Name of the entity property. Note a property name must be unique for an entity. Property name must follow camelCase naming adopted by openMetadata - must start with lower case with no space, underscore, or dots. Refer to *[../type/basic.json#/definitions/entityName](#/type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name for the custom property.Must be unique for an entity.
- **`description`**: Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`propertyType`**: Refer to *[#/definitions/propertyType](#definitions/propertyType)*.
- **`customPropertyConfig`**: Refer to *[#/definitions/customPropertyConfig](#definitions/customPropertyConfig)*.
## Definitions

- **`format`** *(string)*: Applies to date interval, date, time format.
- **`entityTypes`** *(array)*: Applies to Entity References. Entity Types can be used to restrict what type of entities can be configured for a entity reference.
  - **Items** *(string)*
- **`customPropertyConfig`** *(object)*: Config to define constraints around CustomProperty. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[../type/customProperties/enumConfig.json](#/type/customProperties/enumConfig.json)*.
      - : Refer to *[#/definitions/format](#definitions/format)*.
      - : Refer to *[#/definitions/entityTypes](#definitions/entityTypes)*.
      - : Refer to *[customProperties/tableConfig.json](#stomProperties/tableConfig.json)*.
- **`propertyType`**: Reference to a property type. Only property types are allowed and entity types are not allowed as custom properties to extend an existing entity. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
