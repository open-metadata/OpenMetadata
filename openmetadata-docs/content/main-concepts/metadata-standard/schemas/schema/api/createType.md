---
title: createType
slug: /main-concepts/metadata-standard/schemas/schema/api
---

# createType

*Create a Type to be used for extending entities.*

## Properties

- **`name`**: Unique name that identifies a Type. Refer to *../entity/type.json#/definitions/typeName*.
- **`displayName`** *(string)*: Display Name that identifies this Type.
- **`description`**: Optional description of the type. Refer to *../type/basic.json#/definitions/markdown*.
- **`nameSpace`** *(string)*: Namespace or group to which this type belongs to. Default: `custom`.
- **`category`**: Refer to *../entity/type.json#/definitions/category*.
- **`schema`**: JSON schema encoded as string. This will be used to validate the type values. Refer to *../type/basic.json#/definitions/jsonSchema*.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
