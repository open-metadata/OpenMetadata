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
- **`time`** *(string)*: time in ISO 8601 format. Example - '20:20:39+00:00'.
- **`timezone`** *(string)*: Timezone of the user in the format `America/Los_Angeles`, `Brazil/East`, etc.
- **`entityLink`** *(string)*: Link to an entity or field within an entity using this format `<#E::{entities}::{entityType}::{field}::{arrayFieldName}::{arrayFieldValue}`.
- **`entityName`** *(string)*: Name that identifies an entity.
- **`fullyQualifiedEntityName`** *(string)*: A unique name that identifies an entity. Example for table 'DatabaseService:Database:Table'.
- **`sqlQuery`** *(string)*: SQL query statement. Example - 'select * from orders'.
- **`sqlFunction`** *(string)*: SQL function. Example - 'AVG()`, `COUNT()`, etc..
- **`markdown`** *(string)*: Text in Markdown format.
- **`expression`** *(string)*: Expression in SpEL.
- **`jsonSchema`** *(string)*: JSON schema encoded as string. This will be used to validate the JSON fields using this schema.
- **`entityExtension`**: Entity extension data with custom attributes added to the entity.
- **`providerType`** *(string)*: Type of provider of an entity. Some entities are provided by the `system`. Some are are entities created and provided by the `user`. Typically `system` provide entities can't be deleted and can only be disabled. Must be one of: `['system', 'user']`. Default: `user`.
- **`componentConfig`** *(object)*: key/value pairs to pass to workflow component. Can contain additional properties.
  - **Additional Properties**
- **`status`** *(string)*: State of an action over API. Must be one of: `['success', 'failure', 'aborted', 'partialSuccess']`.
- **`sourceUrl`** *(string)*: Source Url of the respective entity.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
