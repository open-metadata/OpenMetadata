# Report Entity

## report

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json
```

Entity that represents a Report

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [report.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json) |

### Report entity Type

`object` \([Report entity](report.md)\)

## Report entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](report.md#id) | `string` | Required | cannot be null | [Common type](../types/common.md#common-definitions-uuid) |
| [name](report.md#name) | `string` | Required | cannot be null | [Report entity](report.md#report-properties-name) |
| [fullyQualifiedName](report.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Report entity](report.md#report-properties-fullyqualifiedname) |
| [description](report.md#description) | `string` | Optional | cannot be null | [Report entity](report.md#report-properties-description) |
| [href](report.md#href) | `string` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-href) |
| [owner](report.md#owner) | `object` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |
| [service](report.md#service) | `object` | Required | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |
| [usageSummary](report.md#usagesummary) | `object` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-usagedetails) |

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

Name that identifies the this report instance uniquely.

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Report entity](report.md#report-properties-name)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

### fullyQualifiedName

Unique name that identifies a report in the format 'ServiceName.ReportName'

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Report entity](report.md#report-properties-fullyqualifiedname)

#### fullyQualifiedName Type

`string`

#### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

### description

Description of this report instance.

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Report entity](report.md#report-properties-description)

#### description Type

`string`

### href

Link to the resource corresponding to this report

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

Link to service where this report is hosted in

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

## report-properties-description

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json#/properties/description
```

Description of this report instance.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [report.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json) |

### description Type

`string`

## report-properties-fullyqualifiedname

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json#/properties/fullyQualifiedName
```

Unique name that identifies a report in the format 'ServiceName.ReportName'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [report.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json) |

### fullyQualifiedName Type

`string`

### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## report-properties-name

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json#/properties/name
```

Name that identifies the this report instance uniquely.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [report.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

