---
title: Create Type API | OpenMetadata Type Creation API
slug: /main-concepts/metadata-standard/schemas/api/createtype
---

# createType

*Create a Type to be used for extending entities.*

## Properties

- **`name`**: Unique name that identifies a Type. Refer to *[../entity/type.json#/definitions/entityName](#/entity/type.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Type.
- **`description`**: Optional description of the type. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`nameSpace`** *(string)*: Namespace or group to which this type belongs to. Default: `"custom"`.
- **`category`**: Refer to *[../entity/type.json#/definitions/category](#/entity/type.json#/definitions/category)*.
- **`schema`**: JSON schema encoded as string. This will be used to validate the type values. Refer to *[../type/basic.json#/definitions/jsonSchema](#/type/basic.json#/definitions/jsonSchema)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
