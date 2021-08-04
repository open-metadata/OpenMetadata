# metrics

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json
```

Entity that represents a Metrics

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                      |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [metrics.json](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json "open original schema") |

## Metrics entity Type

`object` ([Metrics entity](metrics.md))

# Metrics entity Properties

| Property                                  | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                 |
| :---------------------------------------- | :------- | :------- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#id)                                 | `string` | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                                |
| [name](#name)                             | `string` | Required | cannot be null | [Metrics entity](#metrics-properties-name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/name")                             |
| [fullyQualifiedName](#fullyqualifiedname) | `string` | Optional | cannot be null | [Metrics entity](#metrics-properties-fullyqualifiedname "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/fullyQualifiedName") |
| [description](#description)               | `string` | Optional | cannot be null | [Metrics entity](#metrics-properties-description "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/description")               |
| [href](#href)                             | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href)                              |
| [owner](#owner)                           | `object` | Optional | cannot be null | [Entity Reference type](../types/entityreference.md)                                   |
| [service](#service)                       | `object` | Required | cannot be null | [Entity Reference type](../types/entityreference.md)                                 |
| [usageSummary](#usagesummary)             | `object` | Optional | cannot be null | [Usage Details type](../types/usagedetails.md)                                  |

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

## name

Name that identifies the this metrics instance uniquely.

`name`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Metrics entity](#metrics-properties-name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/name")

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## fullyQualifiedName

Unique name that identifies a metric in the format 'ServiceName.MetricName'

`fullyQualifiedName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Metrics entity](#metrics-properties-fullyqualifiedname "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/fullyQualifiedName")

### fullyQualifiedName Type

`string`

### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## description

Description of metrics instance. What is has and how to use it

`description`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Metrics entity](#metrics-properties-description "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/description")

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
# metrics-properties-description

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/description
```

Description of metrics instance. What is has and how to use it

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                       |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [metrics.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json "open original schema") |

## description Type

`string`
# metrics-properties-fullyqualifiedname

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/fullyQualifiedName
```

Unique name that identifies a metric in the format 'ServiceName.MetricName'

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                       |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [metrics.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json "open original schema") |

## fullyQualifiedName Type

`string`

## fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`
# metrics-properties-name

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json#/properties/name
```

Name that identifies the this metrics instance uniquely.

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                       |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [metrics.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`
