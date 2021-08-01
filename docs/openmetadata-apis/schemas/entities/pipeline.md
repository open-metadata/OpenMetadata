# Pipeline Entity

## pipeline

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json
```

Entity that represents a Pipeline

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [pipeline.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json) |

### Pipeline entity Type

`object` \([Pipeline entity](pipeline.md)\)

## Pipeline entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](pipeline.md#id) | `string` | Required | cannot be null | [Common type](../types/common.md#common-definitions-uuid) |
| [name](pipeline.md#name) | `string` | Required | cannot be null | [Pipeline entity](pipeline.md#pipeline-properties-name) |
| [fullyQualifiedName](pipeline.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Pipeline entity](pipeline.md#pipeline-properties-fullyqualifiedname) |
| [description](pipeline.md#description) | `string` | Optional | cannot be null | [Pipeline entity](pipeline.md#pipeline-properties-description) |
| [href](pipeline.md#href) | `string` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-href) |
| [owner](pipeline.md#owner) | `object` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |
| [service](pipeline.md#service) | `object` | Required | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |

### id

Unique id used to identify an entity

`id`

* is required
* Type: `string`
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-uuid)

#### id Type

`string`

#### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

### name

Name that identifies the this pipeline instance uniquely.

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Pipeline entity](pipeline.md#pipeline-properties-name)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

### fullyQualifiedName

Unique name that identifies a pipeline in the format 'ServiceName.PipelineName'

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Pipeline entity](pipeline.md#pipeline-properties-fullyqualifiedname)

#### fullyQualifiedName Type

`string`

#### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

### description

Description of this pipeline.

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Pipeline entity](pipeline.md#pipeline-properties-description)

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

Owner of this pipeline

> Entity reference that includes entity ID and entity type

`owner`

* is optional
* Type: `object` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreference)

#### owner Type

`object` \([Details](../types/common.md#common-definitions-entityreference)\)

### service

Link to service where this pipeline is hosted in

> Entity reference that includes entity ID and entity type

`service`

* is required
* Type: `object` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreference)

#### service Type

`object` \([Details](../types/common.md#common-definitions-entityreference)\)

## pipeline-properties-description

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json#/properties/description
```

Description of this pipeline.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [pipeline.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json) |

### description Type

`string`

## pipeline-properties-fullyqualifiedname

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json#/properties/fullyQualifiedName
```

Unique name that identifies a pipeline in the format 'ServiceName.PipelineName'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [pipeline.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json) |

### fullyQualifiedName Type

`string`

### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## pipeline-properties-name

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json#/properties/name
```

Name that identifies the this pipeline instance uniquely.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [pipeline.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

