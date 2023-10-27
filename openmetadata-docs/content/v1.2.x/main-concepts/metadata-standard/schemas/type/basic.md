---
title: basic
slug: /main-concepts/metadata-standard/schemas/type/basic
---

# Basic

*This schema defines basic common types that are used by other schemas.*

## Definitions

- <a id="definitions/integer"></a>**`integer`** *(integer)*: An integer type.
- <a id="definitions/number"></a>**`number`** *(integer)*: A numeric type that includes integer or floating point numbers.
- <a id="definitions/string"></a>**`string`** *(string)*: A String type.
- <a id="definitions/uuid"></a>**`uuid`** *(string, format: uuid)*: Unique id used to identify an entity.
- <a id="definitions/email"></a>**`email`** *(string, format: email)*: Email address of a user or other entities.
- <a id="definitions/timestamp"></a>**`timestamp`** *(integer, format: utc-millisec)*: Timestamp in Unix epoch time milliseconds.
- <a id="definitions/href"></a>**`href`** *(string, format: uri)*: URI that points to a resource.
- <a id="definitions/timeInterval"></a>**`timeInterval`** *(object)*: Time interval in unixTimeMillis. Cannot contain additional properties.
  - **`start`** *(integer)*: Start time in unixTimeMillis.
  - **`end`** *(integer)*: End time in unixTimeMillis.
- <a id="definitions/duration"></a>**`duration`** *(string)*: Duration in ISO 8601 format in UTC. Example - 'P23DT23H'.
- <a id="definitions/date"></a>**`date`** *(string, format: date)*: Date in ISO 8601 format in UTC. Example - '2018-11-13'.
- <a id="definitions/dateTime"></a>**`dateTime`** *(string, format: date-time)*: Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'.
- <a id="definitions/time"></a>**`time`** *(string, format: time)*: time in ISO 8601 format. Example - '20:20:39+00:00'.
- <a id="definitions/timezone"></a>**`timezone`** *(string, format: timezone)*: Timezone of the user in the format `America/Los_Angeles`, `Brazil/East`, etc.
- <a id="definitions/entityLink"></a>**`entityLink`** *(string)*: Link to an entity or field within an entity using this format `<#E::{entities}::{entityType}::{field}::{arrayFieldName}::{arrayFieldValue}`.
- <a id="definitions/entityName"></a>**`entityName`** *(string)*: Name that identifies an entity.
- <a id="definitions/fullyQualifiedEntityName"></a>**`fullyQualifiedEntityName`** *(string)*: A unique name that identifies an entity. Example for table 'DatabaseService.Database.Schema.Table'.
- <a id="definitions/sqlQuery"></a>**`sqlQuery`** *(string)*: SQL query statement. Example - 'select * from orders'.
- <a id="definitions/sqlFunction"></a>**`sqlFunction`** *(string)*: SQL function. Example - 'AVG()`, `COUNT()`, etc..
- <a id="definitions/markdown"></a>**`markdown`** *(string)*: Text in Markdown format.
- <a id="definitions/expression"></a>**`expression`** *(string)*: Expression in SpEL.
- <a id="definitions/jsonSchema"></a>**`jsonSchema`** *(string)*: JSON schema encoded as string. This will be used to validate the JSON fields using this schema.
- <a id="definitions/entityExtension"></a>**`entityExtension`**: Entity extension data with custom attributes added to the entity.
- <a id="definitions/providerType"></a>**`providerType`** *(string)*: Type of provider of an entity. Some entities are provided by the `system`. Some are entities created and provided by the `user`. Typically `system` provide entities can't be deleted and can only be disabled. Must be one of: `["system", "user"]`. Default: `"user"`.
- <a id="definitions/componentConfig"></a>**`componentConfig`** *(object)*: key/value pairs to pass to workflow component. Can contain additional properties.
  - **Additional Properties**
- <a id="definitions/status"></a>**`status`** *(string)*: State of an action over API. Must be one of: `["success", "failure", "aborted", "partialSuccess"]`.
- <a id="definitions/sourceUrl"></a>**`sourceUrl`** *(string, format: url)*: Source Url of the respective entity.
- <a id="definitions/style"></a>**`style`** *(object)*: UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. Cannot contain additional properties.
  - **`color`** *(string)*: Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
  - **`iconURL`** *(string, format: url)*: An icon to associate with GlossaryTerm, Tag, Domain or Data Product.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
