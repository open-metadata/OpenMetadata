# Usage Details Type

## usagedetails

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json
```

Type used to return usage details of an entity

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Allowed | none | [usageDetails.json](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/out/type/usageDetails.json) |

### Type used to return usage details of an entity Type

`object` \([Type used to return usage details of an entity](usagedetails.md)\)

## Type used to return usage details of an entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [dailyStats](usagedetails.md#dailystats) | `object` | Required | cannot be null | [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats) |
| [weeklyStats](usagedetails.md#weeklystats) | `object` | Optional | cannot be null | [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats) |
| [monthlyStats](usagedetails.md#monthlystats) | `object` | Optional | cannot be null | [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats) |
| [date](usagedetails.md#date) | `string` | Required | cannot be null | [Basic type](basic.md#basic-definitions-date) |

### dailyStats

> Type used to return usage statistics

`dailyStats`

* is required
* Type: `object` \([Details](usagedetails.md#usagedetails-definitions-usagestats)\)
* cannot be null
* defined in: [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats)

#### dailyStats Type

`object` \([Details](usagedetails.md#usagedetails-definitions-usagestats)\)

### weeklyStats

> Type used to return usage statistics

`weeklyStats`

* is optional
* Type: `object` \([Details](usagedetails.md#usagedetails-definitions-usagestats)\)
* cannot be null
* defined in: [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats)

#### weeklyStats Type

`object` \([Details](usagedetails.md#usagedetails-definitions-usagestats)\)

### monthlyStats

> Type used to return usage statistics

`monthlyStats`

* is optional
* Type: `object` \([Details](usagedetails.md#usagedetails-definitions-usagestats)\)
* cannot be null
* defined in: [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats)

#### monthlyStats Type

`object` \([Details](usagedetails.md#usagedetails-definitions-usagestats)\)

### date

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

`date`

* is required
* Type: `string`
* cannot be null
* defined in: [Basic type](basic.md#basic-definitions-date)

#### date Type

`string`

#### date Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

## Type used to return usage details of an entity Definitions

### Definitions group usageStats

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [count](usagedetails.md#count) | `integer` | Required | cannot be null | [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats-properties-count) |
| [percentileRank](usagedetails.md#percentilerank) | `number` | Optional | cannot be null | [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats-properties-percentilerank) |

#### count

`count`

* is required
* Type: `integer`
* cannot be null
* defined in: [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats-properties-count)

**count Type**

`integer`

**count Constraints**

**minimum**: the value of this number must greater than or equal to: `0`

#### percentileRank

`percentileRank`

* is optional
* Type: `number`
* cannot be null
* defined in: [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats-properties-percentilerank)

**percentileRank Type**

`number`

**percentileRank Constraints**

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`

## usagedetails-definitions-usagestats-properties-count

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/count
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [usageDetails.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/out/type/usageDetails.json) |

### count Type

`integer`

### count Constraints

**minimum**: the value of this number must greater than or equal to: `0`

## usagedetails-definitions-usagestats-properties-percentilerank

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/percentileRank
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [usageDetails.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/out/type/usageDetails.json) |

### percentileRank Type

`number`

### percentileRank Constraints

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`

## usagedetails-definitions-usagestats

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/properties/monthlyStats
```

> Type used to return usage statistics

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Forbidden | none | [usageDetails.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/out/type/usageDetails.json) |

### monthlyStats Type

`object` \([Details](usagedetails.md#usagedetails-definitions-usagestats)\)

## monthlyStats Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [count](usagedetails.md#count) | `integer` | Required | cannot be null | [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats-properties-count) |
| [percentileRank](usagedetails.md#percentilerank) | `number` | Optional | cannot be null | [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats-properties-percentilerank) |

### count

`count`

* is required
* Type: `integer`
* cannot be null
* defined in: [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats-properties-count)

#### count Type

`integer`

#### count Constraints

**minimum**: the value of this number must greater than or equal to: `0`

### percentileRank

`percentileRank`

* is optional
* Type: `number`
* cannot be null
* defined in: [Type used to return usage details of an entity](usagedetails.md#usagedetails-definitions-usagestats-properties-percentilerank)

#### percentileRank Type

`number`

#### percentileRank Constraints

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`

## usagedetails-definitions

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [usageDetails.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/out/type/usageDetails.json) |

### definitions Type

unknown

