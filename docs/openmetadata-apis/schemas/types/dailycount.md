# Daily Count Type

## dailycount

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/dailyCount.json
```

Type used for capturing and reporting daily count of some measurement, such as usage, joins

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [dailyCount.json](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/dailyCount.json) |

### Daily count of some measurement Type

`object` \([Daily count of some measurement](dailycount.md)\)

## Daily count of some measurement Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [count](dailycount.md#count) | `integer` | Required | cannot be null | [Daily count of some measurement](dailycount.md#dailycount-properties-count) |
| [date](dailycount.md#date) | `string` | Required | cannot be null | [Basic type](basic.md#basic-definitions-date) |

### count

Daily count of a measurement on the given date

`count`

* is required
* Type: `integer`
* cannot be null
* defined in: [Daily count of some measurement](dailycount.md#dailycount-properties-count)

#### count Type

`integer`

#### count Constraints

**minimum**: the value of this number must greater than or equal to: `0`

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

## dailycount-properties-count

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/dailyCount.json#/properties/count
```

Daily count of a measurement on the given date

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [dailyCount.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/dailyCount.json) |

### count Type

`integer`

### count Constraints

**minimum**: the value of this number must greater than or equal to: `0`

