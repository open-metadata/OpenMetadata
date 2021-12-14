# Basic

This schema defines basic common types that are used by other schemas.

**$id:** [**https://open-metadata.org/schema/type/basic.json**](https://open-metadata.org/schema/type/basic.json)

## Type definitions in this schema

### uuid

- Unique id used to identify an entity.
- Type: `string`
- String format must be a "uuid"


### email

- Email address of a user or other entities.
- Type: `string`
- String format must be a "email"
- The value must match this pattern: `^\S+@\S+\.\S+$`
- Length: between 6 and 127


### timestamp

- Timestamp in unixTimeMillis.
- Type: `string`
- String format must be a "utc-millisec"


### href

- URI that points to a resource.
- Type: `string`
- String format must be a "uri"


### timeInterval

- Time interval in unixTimeMillis.
- Type: `object`
- **Properties**
  - **start**
    - Start time in unixTimeMillis.
    - Type: `integer`
  - **end**
    - End time in unixTimeMillis.
    - Type: `integer`

### duration

- Duration in ISO 8601 format in UTC. Example - 'P23DT23H'.
- Type: `string`

### date

- Date in ISO 8601 format in UTC. Example - '2018-11-13'.
- Type: `string`
- String format must be a "date"

### dateTime

- Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'.
- Type: `string`
- String format must be a "date-time"

### entityLink

- Link to an entity or field within an entity using this format `<#E/{enties}/{entityName}/{field}/{fieldValue}`.
- Type: `string`
- The value must match this pattern: `^<#E/\S+/\S+>$`

### sqlQuery

- SQL query statement. Example - 'select * from orders'.
- Type: `string`

_This document was updated on: Tuesday, December 14, 2021_