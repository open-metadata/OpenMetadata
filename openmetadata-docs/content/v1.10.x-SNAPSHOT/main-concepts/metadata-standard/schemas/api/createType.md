---
title: createType
slug: /main-concepts/metadata-standard/schemas/api/createtype
---

# createType

*Create a Type to be used for extending entities.*

## Properties

- **`name`**: Unique name that identifies a Type. Refer to *../entity/type.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Type.
- **`description`**: Optional description of the type. Refer to *../type/basic.json#/definitions/markdown*.
- **`nameSpace`** *(string)*: Namespace or group to which this type belongs to. Default: `custom`.
- **`category`**: Refer to *../entity/type.json#/definitions/category*.
- **`schema`**: JSON schema encoded as string. This will be used to validate the type values. Refer to *../type/basic.json#/definitions/jsonSchema*.
- **`domains`** *(array)*: Fully qualified names of the domains the Type belongs to.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
