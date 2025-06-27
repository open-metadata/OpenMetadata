---
title: Basic Schema | OpenMetadata Basic Schema Details
slug: /main-concepts/metadata-standard/schemas/type/basic
---

# Basic

*This schema defines basic common types that are used by other schemas.*

## Definitions

- **`integer`** *(integer)*: An integer type.
- **`number`** *(integer)*: A numeric type that includes integer or floating point numbers.
- **`string`** *(string)*: A String type.
- **`uuid`** *(string, format: uuid)*: Unique id used to identify an entity.
- **`email`** *(string, format: email)*: Email address of a user or other entities.
- **`timestamp`** *(integer, format: utc-millisec)*: Timestamp in Unix epoch time milliseconds.
- **`href`** *(string, format: uri)*: URI that points to a resource.
- **`timeInterval`** *(object)*: Time interval in unixTimeMillis. Cannot contain additional properties.
  - **`start`** *(integer)*: Start time in unixTimeMillis.
  - **`end`** *(integer)*: End time in unixTimeMillis.
- **`duration`** *(string)*: Duration in ISO 8601 format in UTC. Example - 'P23DT23H'.
- **`date`** *(string, format: date)*: Date in ISO 8601 format in UTC. Example - '2018-11-13'.
- **`dateTime`** *(string, format: date-time)*: Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'.
- **`time`** *(string, format: time)*: time in ISO 8601 format. Example - '20:20:39+00:00'.
- **`date-cp`** *(string)*: Date as defined in custom property.
- **`dateTime-cp`** *(string)*: Date and time as defined in custom property.
- **`time-cp`** *(string)*: Time as defined in custom property.
- **`enum`** *(array)*: List of values in Enum.
  - **Items** *(string)*
- **`timezone`** *(string, format: timezone)*: Timezone of the user in the format `America/Los_Angeles`, `Brazil/East`, etc.
- **`entityLink`** *(string)*: Link to an entity or field within an entity using this format `<#E::{entities}::{entityType}::{field}::{arrayFieldName}::{arrayFieldValue}`.
- **`entityName`** *(string)*: Name that identifies an entity.
- **`testCaseEntityName`** *(string)*: Name that identifies a test definition and test case.
- **`fullyQualifiedEntityName`** *(string)*: A unique name that identifies an entity. Example for table 'DatabaseService.Database.Schema.Table'.
- **`sqlQuery`** *(string)*: SQL query statement. Example - 'select * from orders'.
- **`sqlFunction`** *(string)*: SQL function. Example - 'AVG()`, `COUNT()`, etc..
- **`markdown`** *(string)*: Text in Markdown format.
- **`expression`** *(string)*: Expression in SpEL.
- **`jsonSchema`** *(string)*: JSON schema encoded as string. This will be used to validate the JSON fields using this schema.
- **`entityExtension`**: Entity extension data with custom attributes added to the entity.
- **`providerType`** *(string)*: Type of provider of an entity. Some entities are provided by the `system`. Some are entities created and provided by the `user`. Typically `system` provide entities can't be deleted and can only be disabled. Must be one of: `["system", "user"]`. Default: `"user"`.
- **`componentConfig`** *(object)*: key/value pairs to pass to workflow component. Can contain additional properties.
  - **Additional Properties**
- **`status`** *(string)*: State of an action over API. Must be one of: `["success", "failure", "aborted", "partialSuccess"]`.
- **`sourceUrl`** *(string, format: url)*: Source Url of the respective entity.
- **`style`** *(object)*: UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. Cannot contain additional properties.
  - **`color`** *(string)*: Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
  - **`iconURL`** *(string, format: url)*: An icon to associate with GlossaryTerm, Tag, Domain or Data Product.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
