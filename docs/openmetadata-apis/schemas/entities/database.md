# Database Entity

## database

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json
```

Entity that represents a database

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Allowed | none | [database.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json) |

### Database entity Type

`object` \([Database entity](database.md)\)

## Database entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](database.md#id) | `string` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-uuid) |
| [name](database.md#name) | `string` | Required | cannot be null | [Database entity](database.md#database-properties-name) |
| [fullyQualifiedName](database.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Database entity](database.md#database-properties-fullyqualifiedname) |
| [description](database.md#description) | `string` | Optional | cannot be null | [Database entity](database.md#database-properties-description) |
| [href](database.md#href) | `string` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-href) |
| [owner](database.md#owner) | `object` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |
| [service](database.md#service) | `object` | Required | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |
| [usageSummary](database.md#usagesummary) | `object` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-usagedetails) |
| [tables](database.md#tables) | `array` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-entityreferencelist) |

### id

Unique id used to identify an entity

`id`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-uuid)

#### id Type

`string`

#### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

### name

Name that identifies the database

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Database entity](database.md#database-properties-name)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

### fullyQualifiedName

Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Database entity](database.md#database-properties-fullyqualifiedname)

#### fullyQualifiedName Type

`string`

### description

Description of the database instance. What it has and how to use it.

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Database entity](database.md#database-properties-description)

#### description Type

`string`

### href

Link to the resource corresponding to this entity

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-href)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### owner

Owner of this database

> Entity reference that includes entity ID and entity type

`owner`

* is optional
* Type: `object` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreference)

#### owner Type

`object` \([Details](../types/common.md#common-definitions-entityreference)\)

### service

Link to the database cluster/service where this database is hosted in

> Entity reference that includes entity ID and entity type

`service`

* is required
* Type: `object` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreference)

#### service Type

`object` \([Details](../types/common.md#common-definitions-entityreference)\)

### usageSummary

Latest usage information for this database

> Type used to return usage details

`usageSummary`

* is optional
* Type: `object` \([Details](../types/common.md#common-definitions-usagedetails)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-usagedetails)

#### usageSummary Type

`object` \([Details](../types/common.md#common-definitions-usagedetails)\)

### tables

References to tables in the database

`tables`

* is optional
* Type: `object[]` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreferencelist)

#### tables Type

`object[]` \([Details](../types/common.md#common-definitions-entityreference)\)

## Database entity Definitions

### Definitions group databaseName

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/definitions/databaseName"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


## database-definitions-databasename

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/definitions/databaseName
```

Name that identifies the database

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [database.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json) |

### databaseName Type

`string`

### databaseName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

## database-definitions

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [database.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json) |

### definitions Type

unknown

## database-properties-description

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/description
```

Description of the database instance. What it has and how to use it.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [database.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json) |

### description Type

`string`

## database-properties-fullyqualifiedname

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/fullyQualifiedName
```

Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [database.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json) |

### fullyQualifiedName Type

`string`

## database-properties-name

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json#/properties/name
```

Name that identifies the database

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [database.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

