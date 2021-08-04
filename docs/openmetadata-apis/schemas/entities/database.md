# database

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json
```

Entity that represents a database

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                        |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [database.json](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json "open original schema") |

## Database entity Type

`object` ([Database entity](database.md))

# Database entity Properties

| Property                                  | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                    |
| :---------------------------------------- | :------- | :------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#id)                                 | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                                 |
| [name](#name)                             | `string` | Required | cannot be null | [Database entity](#database-properties-name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/name")                             |
| [fullyQualifiedName](#fullyqualifiedname) | `string` | Optional | cannot be null | [Database entity](#database-properties-fullyqualifiedname "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/fullyQualifiedName") |
| [description](#description)               | `string` | Optional | cannot be null | [Database entity](#database-properties-description "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/description")               |
| [href](#href)                             | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href)                               |
| [owner](#owner)                           | `object` | Optional | cannot be null | [Entity Reference type](../types/entityreference.md)                                     |
| [service](#service)                       | `object` | Required | cannot be null | [Entity Reference type](../types/entityreference.md)                                   |
| [usageSummary](#usagesummary)             | `object` | Optional | cannot be null | [Usage Details type](../types/usagedetails.md)                                    |
| [tables](#tables)                         | `array`  | Optional | cannot be null | [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)    |

## id

Unique id used to identify an entity

`id`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-uuid)

### id Type

`string`

### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122 "check the specification")

## name

Name that identifies the database

`name`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Database entity](#database-properties-name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/name")

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")

## fullyQualifiedName

Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'

`fullyQualifiedName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Database entity](#database-properties-fullyqualifiedname "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/fullyQualifiedName")

### fullyQualifiedName Type

`string`

## description

Description of the database instance. What it has and how to use it.

`description`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Database entity](#database-properties-description "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/description")

### description Type

`string`

## href

Link to the resource corresponding to this entity

> Link to the resource

`href`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-href)

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## owner

Entity reference that includes entity ID and entity type

`owner`

*   is optional

*   Type: `object` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md)

### owner Type

`object` ([Entity Reference](entityreference.md))

## service

Entity reference that includes entity ID and entity type

`service`

*   is required

*   Type: `object` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md)

### service Type

`object` ([Entity Reference](entityreference.md))

## usageSummary

Type used to return usage details of an entity

`usageSummary`

*   is optional

*   Type: `object` ([Type used to return usage details of an entity](usagedetails.md))

*   cannot be null

*   defined in: [Usage Details type](../types/usagedetails.md)

### usageSummary Type

`object` ([Type used to return usage details of an entity](usagedetails.md))

## tables

References to tables in the database

`tables`

*   is optional

*   Type: `object[]` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)

### tables Type

`object[]` ([Entity Reference](entityreference.md))

# Database entity Definitions

## Definitions group databaseName

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/definitions/databaseName"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |
# database-definitions-databasename

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/data/createDatabase.json#/properties/name
```

Name that identifies the database

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createDatabase.json*](../../../../out/api/data/createDatabase.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")
# database-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                         |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [database.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json "open original schema") |

## definitions Type

unknown
# database-properties-description

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/description
```

Description of the database instance. What it has and how to use it.

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                         |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [database.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json "open original schema") |

## description Type

`string`
# database-properties-fullyqualifiedname

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/fullyQualifiedName
```

Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                         |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [database.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json "open original schema") |

## fullyQualifiedName Type

`string`
# database-properties-name

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/name
```

Name that identifies the database

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                         |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [database.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")
