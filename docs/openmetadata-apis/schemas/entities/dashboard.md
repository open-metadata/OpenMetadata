# Dashboard Entity

## dashboard

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json
```

Entity that represents a Dashboard

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [dashboard.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json) |

### Dashboard entity Type

`object` \([Dashboard entity](dashboard.md)\)

## Dashboard entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](dashboard.md#id) | `string` | Required | cannot be null | [Common Type](../types/common.md#common-definitions-uuid) |
| [name](dashboard.md#name) | `string` | Required | cannot be null | [Dashboard entity](dashboard.md#dashboard-properties-name) |
| [fullyQualifiedName](dashboard.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Dashboard entity](dashboard.md#dashboard-properties-fullyqualifiedname) |
| [description](dashboard.md#description) | `string` | Optional | cannot be null | [Dashboard entity](dashboard.md#dashboard-properties-description) |
| [href](dashboard.md#href) | `string` | Optional | cannot be null | [Common Type](../types/common.md#common-definitions-href) |
| [owner](dashboard.md#owner) | `object` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |
| [service](dashboard.md#service) | `object` | Required | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |
| [usageSummary](dashboard.md#usagesummary) | `object` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-usagedetails) |

### id

Unique id used to identify an entity

`id`

* is required
* Type: `string`
* cannot be null
* defined in: [Common Type](../types/common.md#common-definitions-uuid)

#### id Type

`string`

#### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

### name

Name that identifies the this dashboard.

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Dashboard entity](dashboard.md#dashboard-properties-name)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

### fullyQualifiedName

Unique name that identifies a dashboard in the format 'ServiceName.DashboardName'

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Dashboard entity](dashboard.md#dashboard-properties-fullyqualifiedname)

#### fullyQualifiedName Type

`string`

#### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

### description

Description of dashboard, what it is and how to use it.

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Dashboard entity](dashboard.md#dashboard-properties-description)

#### description Type

`string`

### href

Link to the resource corresponding to this entity

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common Type](../types/common.md#common-definitions-href)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### owner

Owner of this dashboard

> Entity reference that includes entity ID and entity type

`owner`

* is optional
* Type: `object` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreference)

#### owner Type

`object` \([Details](../types/common.md#common-definitions-entityreference)\)

### service

Link to service where this dashboard is hosted in

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

## dashboard-properties-description

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json#/properties/description
```

Description of dashboard, what it is and how to use it.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [dashboard.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json) |

### description Type

`string`

## dashboard-properties-fullyqualifiedname

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json#/properties/fullyQualifiedName
```

Unique name that identifies a dashboard in the format 'ServiceName.DashboardName'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [dashboard.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json) |

### fullyQualifiedName Type

`string`

### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## dashboard-properties-name

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json#/properties/name
```

Name that identifies the this dashboard.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [dashboard.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

