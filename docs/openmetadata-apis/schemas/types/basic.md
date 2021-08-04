# basic

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json
```

Common reusable types

| Abstract               | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                           |
| :--------------------- | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------- |
| Cannot be instantiated | Yes        | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [basic.json](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json "open original schema") |

## Common types Type

unknown ([Common types](basic.md))

# Common types Definitions

## Definitions group uuid

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/uuid"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group schema

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/schema"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group email

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/email"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group entityLink

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/entityLink"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group timestamp

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/timestamp"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group href

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/href"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group timeInterval

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/timeInterval"}
```

| Property        | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                            |
| :-------------- | :-------- | :------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [start](#start) | `integer` | Optional | cannot be null | [Basic type](#basic-definitions-timeinterval-properties-start) |
| [end](#end)     | `integer` | Optional | cannot be null | #[Basic type](basic-definitions-timeinterval-properties-end)     |

### start

Start unixTimeMillis

`start`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: [Basic type](#basic-definitions-timeinterval-properties-start)

#### start Type

`integer`

### end

End unixTimeMillis

`end`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: #[Basic type](basic-definitions-timeinterval-properties-end)

#### end Type

`integer`

## Definitions group duration

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/duration"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group date

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/date"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group dateTime

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/dateTime"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |
# basic-definitions-date

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/startDate
```

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## startDate Type

`string`

## startDate Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")
# basic-definitions-datetime

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/schedule.json#/properties/startDate
```

Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [schedule.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/schedule.json "open original schema") |

## startDate Type

`string`

## startDate Constraints

**unknown format**: the value of this string must follow the format: `date-Time`
# basic-definitions-duration

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/schedule.json#/properties/repeatFrequency
```

Duration in ISO 8601 format in UTC time. Example - 'P23DT23H'

> Jsonschema does not handle ISO 8601 duration yet and hence no format for this type

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [schedule.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/schedule.json "open original schema") |

## repeatFrequency Type

`string`
# basic-definitions-email

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/teams/createUser.json#/properties/email
```

Email address of user or other entities

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createUser.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/teams/createUser.json "open original schema") |

## email Type

`string`

## email Constraints

**maximum length**: the maximum number of characters for this string is: `127`

**minimum length**: the minimum number of characters for this string is: `6`

**pattern**: the string must match the following regular expression: 

```regexp
^\S+@\S+\.\S+$
```

[try pattern](https://regexr.com/?expression=%5E%5CS%2B%40%5CS%2B%5C.%5CS%2B%24 "try regular expression with regexr.com")

**email**: the string must be an email address, according to [RFC 5322, section 3.4.1](https://tools.ietf.org/html/rfc5322 "check the specification")
# basic-definitions-entitylink

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/feed/createThread.json#/properties/about
```

Entity or field thread is created for with format <#E/{enties}/{entityName}/{field}/{fieldValue}

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                              |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createThread.json*](../../../../out/api/feed/createThread.json "open original schema") |

## about Type

`string`

## about Constraints

**pattern**: the string must match the following regular expression: 

```regexp
^<#E/\S+/\S+>$
```

[try pattern](https://regexr.com/?expression=%5E%3C%23E%2F%5CS%2B%2F%5CS%2B%3E%24 "try regular expression with regexr.com")
# basic-definitions-href

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/href
```

Link to this table resource

> Link to the resource

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## href Type

`string`

## href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# basic-definitions-schema

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/schema
```

URL for the schema of an entity

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                            |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [basic.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json "open original schema") |

## schema Type

`string`

## schema Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# basic-definitions-timeinterval-properties-end

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/timeInterval/properties/end
```

End unixTimeMillis

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                            |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [basic.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json "open original schema") |

## end Type

`integer`
# basic-definitions-timeinterval-properties-start

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/timeInterval/properties/start
```

Start unixTimeMillis

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                            |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [basic.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json "open original schema") |

## start Type

`integer`
# basic-definitions-timeinterval

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions/timeInterval
```



> Time interval type

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                            |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [basic.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json "open original schema") |

## timeInterval Type

`object` ([Details](../types/basic.md#basic-definitions-timeinterval))

# timeInterval Properties

| Property        | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                            |
| :-------------- | :-------- | :------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [start](#start) | `integer` | Optional | cannot be null | [Basic type](#basic-definitions-timeinterval-properties-start) |
| [end](#end)     | `integer` | Optional | cannot be null | #[Basic type](basic-definitions-timeinterval-properties-end)     |

## start

Start unixTimeMillis

`start`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: [Basic type](#basic-definitions-timeinterval-properties-start)

### start Type

`integer`

## end

End unixTimeMillis

`end`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: #[Basic type](basic-definitions-timeinterval-properties-end)

### end Type

`integer`
# basic-definitions-timestamp

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/catalogVersion.json#/properties/timestamp
```

Build timestamp

> Timestamp type

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                             |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [catalogVersion.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/catalogVersion.json "open original schema") |

## timestamp Type

`string`

## timestamp Constraints

**unknown format**: the value of this string must follow the format: `utc-millisec`
# basic-definitions-uuid

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/database
```

Unique id used to identify an entity

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                            |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createTable.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json "open original schema") |

## database Type

`string`

## database Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122 "check the specification")
# basic-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                            |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [basic.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/basic.json "open original schema") |

## definitions Type

unknown
