# entityreference

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json
```

Entity reference that includes entity ID and entity type

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                               |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [entityReference.json](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json "open original schema") |

## Entity Reference Type

`object` ([Entity Reference](entityreference.md))

# Entity Reference Properties

| Property                    | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                              |
| :-------------------------- | :------- | :------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#id)                   | `string` | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                          |
| [type](#type)               | `string` | Required | cannot be null | [Entity Reference](#entityreference-properties-type "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/type")               |
| [name](#name)               | `string` | Optional | cannot be null | [Entity Reference](#entityreference-properties-name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/name")               |
| [description](#description) | `string` | Optional | cannot be null | [Entity Reference](#entityreference-properties-description "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/description") |
| [href](#href)               | `string` | Optional | cannot be null | [Entity Reference](basic-definitions-href.md "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/href")                        |

## id

Unique id used to identify an entity

`id`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-uuid)

### id Type

`string`

### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122 "check the specification")

## type

Entity type/class name - Examples: database, table, metrics, redshift, mysql, bigquery, snowflake...

`type`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Entity Reference](#entityreference-properties-type "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/type")

### type Type

`string`

## name

Name of the entity instance

`name`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Entity Reference](#entityreference-properties-name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/name")

### name Type

`string`

## description

Optional description of entity

`description`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Entity Reference](#entityreference-properties-description "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/description")

### description Type

`string`

## href

Link to the entity resource

> Link to the resource

`href`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Entity Reference](basic-definitions-href.md "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/href")

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

# Entity Reference Definitions

## Definitions group entityReferenceList

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/definitions/entityReferenceList"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |
# entityreference-definitions-entityreferencelist

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/followers
```

Followers of this table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## followers Type

`object[]` ([Entity Reference](entityreference.md))
# entityreference-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [entityReference.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json "open original schema") |

## definitions Type

unknown
# entityreference-properties-description

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/description
```

Optional description of entity

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [entityReference.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json "open original schema") |

## description Type

`string`
# entityreference-properties-name

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/name
```

Name of the entity instance

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [entityReference.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json "open original schema") |

## name Type

`string`
# entityreference-properties-type

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/type
```

Entity type/class name - Examples: database, table, metrics, redshift, mysql, bigquery, snowflake...

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [entityReference.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json "open original schema") |

## type Type

`string`
