---
title: schema
slug: /main-concepts/metadata-standard/schemas/type/schema
---

# Topic

*This schema defines the Topic entity. A topic is a feed into which message are published to by publishers and read from by consumers in a messaging service.*

## Properties

- **`schemaText`** *(string)*: Schema used for message serialization. Optional as some topics may not have associated schemas.
- **`schemaType`**: Schema used for message serialization. Refer to *#/definitions/schemaType*. Default: `None`.
- **`schemaFields`** *(array)*: Columns in this schema. Default: `[]`.
  - **Items**: Refer to *#/definitions/field*.
## Definitions

- **`schemaType`**: Schema type used for the message. Must be one of: `['Avro', 'Protobuf', 'JSON', 'Other', 'None']`.
- **`dataTypeTopic`** *(string)*: This enum defines the type of data defined in schema. Must be one of: `['RECORD', 'NULL', 'BOOLEAN', 'INT', 'LONG', 'BYTES', 'FLOAT', 'DOUBLE', 'TIMESTAMP', 'TIMESTAMPZ', 'TIME', 'DATE', 'STRING', 'ARRAY', 'MAP', 'ENUM', 'UNION', 'FIXED', 'ERROR', 'UNKNOWN']`.
- **`fieldName`** *(string)*: Local name (not fully qualified name) of the field. .
- **`field`** *(object)*: This schema defines the nested object to capture protobuf/avro/jsonschema of topic's schema. Cannot contain additional properties.
  - **`name`**: Refer to *#/definitions/fieldName*.
  - **`displayName`** *(string)*: Display Name that identifies this field name.
  - **`dataType`**: Data type of the field (int, date etc.). Refer to *#/definitions/dataTypeTopic*.
  - **`dataTypeDisplay`** *(string)*: Display name used for dataType. This is useful for complex types, such as `array<int>`, `map<int,string>`, `struct<>`, and union types.
  - **`description`**: Description of the column. Refer to *basic.json#/definitions/markdown*.
  - **`fullyQualifiedName`**: Refer to *basic.json#/definitions/fullyQualifiedEntityName*.
  - **`tags`** *(array)*: Tags associated with the column. Default: `None`.
    - **Items**: Refer to *tagLabel.json*.
  - **`children`** *(array)*: Child fields if dataType or arrayDataType is `map`, `record`, `message`. Default: `None`.
    - **Items**: Refer to *#/definitions/field*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
