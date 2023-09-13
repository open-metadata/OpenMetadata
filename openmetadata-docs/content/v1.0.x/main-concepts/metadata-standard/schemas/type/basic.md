---
title: basic
slug: /main-concepts/metadata-standard/schemas/type/basic
---

# Basic

*This schema defines basic common types that are used by other schemas.*

## Definitions

- **`integer`** *(integer)*: An integer type.
- **`number`** *(integer)*: A numeric type that includes integer or floating point numbers.
- **`string`** *(string)*: A String type.
- **`uuid`** *(string)*: Unique id used to identify an entity.
- **`email`** *(string)*: Email address of a user or other entities.
- **`timestamp`** *(integer)*: Timestamp in Unix epoch time milliseconds.
- **`href`** *(string)*: URI that points to a resource.
- **`timeInterval`** *(object)*: Time interval in unixTimeMillis. Cannot contain additional properties.
  - **`start`** *(integer)*: Start time in unixTimeMillis.
  - **`end`** *(integer)*: End time in unixTimeMillis.
- **`duration`** *(string)*: Duration in ISO 8601 format in UTC. Example - 'P23DT23H'.
- **`date`** *(string)*: Date in ISO 8601 format in UTC. Example - '2018-11-13'.
- **`dateTime`** *(string)*: Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'.
- **`entityLink`** *(string)*: Link to an entity or field within an entity using this format `<#E::{entities}::{entityType}::{field}::{arrayFieldName}::{arrayFieldValue}`.
- **`entityName`** *(string)*: Name that identifies this dashboard service.
- **`fullyQualifiedEntityName`** *(string)*: A unique name that identifies an entity. Example for table 'DatabaseService:Database:Table'.
- **`sqlQuery`** *(string)*: SQL query statement. Example - 'select * from orders'.
- **`sqlFunction`** *(string)*: SQL function. Example - 'AVG()`, `COUNT()`, etc..
- **`markdown`** *(string)*: Text in Markdown format.
- **`jsonSchema`** *(string)*: JSON schema encoded as string. This will be used to validate the JSON fields using this schema.
- **`entityExtension`**: Entity extension data with custom attributes added to the entity.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
