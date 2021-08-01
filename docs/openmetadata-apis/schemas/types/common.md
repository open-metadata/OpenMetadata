# Common Type

## common

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json
```

Common reusable types

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Cannot be instantiated | Yes | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### Common types Type

unknown \([Common types](common.md)\)

## Common types Definitions

### Definitions group uuid

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/uuid"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group schema

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/schema"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group email

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/email"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group timestamp

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/timestamp"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group href

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/href"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group timeInterval

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/timeInterval"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [start](common.md#start) | `integer` | Optional | cannot be null | [Common types](common.md#common-definitions-timeinterval-properties-start) |
| [end](common.md#end) | `integer` | Optional | cannot be null | [Common types](common.md#common-definitions-timeinterval-properties-end) |

#### start

Start unixTimeMillis

`start`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Common types](common.md#common-definitions-timeinterval-properties-start)

**start Type**

`integer`

#### end

End unixTimeMillis

`end`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Common types](common.md#common-definitions-timeinterval-properties-end)

**end Type**

`integer`

### Definitions group duration

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/duration"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group date

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/date"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group dateTime

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/dateTime"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group schedule

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/schedule"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [startDate](common.md#startdate) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-datetime) |
| [repeatFrequency](common.md#repeatfrequency) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-duration) |

#### startDate

Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'

`startDate`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-datetime)

**startDate Type**

`string`

**startDate Constraints**

**unknown format**: the value of this string must follow the format: `date-Time`

#### repeatFrequency

Duration in ISO 8601 format in UTC time. Example - 'P23DT23H'

> Jsonschema does not handle ISO 8601 duration yet and hence no format for this type

`repeatFrequency`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-duration)

**repeatFrequency Type**

`string`

### Definitions group entityReference

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/entityReference"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](common.md#id) | `string` | Required | cannot be null | [Common types](common.md#common-definitions-uuid) |
| [type](common.md#type) | `string` | Required | cannot be null | [Common types](common.md#common-definitions-entityreference-properties-type) |
| [name](common.md#name) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-entityreference-properties-name) |
| [description](common.md#description) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-entityreference-properties-description) |
| [href](common.md#href) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-href) |

#### id

Unique id used to identify an entity

`id`

* is required
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-uuid)

**id Type**

`string`

**id Constraints**

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

#### type

Entity type/class name - Examples: database, table, metrics, redshift, mysql, bigquery, snowflake...

`type`

* is required
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-entityreference-properties-type)

**type Type**

`string`

#### name

Name of the entity instance

`name`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-entityreference-properties-name)

**name Type**

`string`

#### description

Optional description of entity

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-entityreference-properties-description)

**description Type**

`string`

#### href

Link to the entity resource

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-href)

**href Type**

`string`

**href Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### Definitions group entityReferenceList

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/entityReferenceList"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group usageStats

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/usageStats"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [count](common.md#count) | `integer` | Required | cannot be null | [Common types](common.md#common-definitions-usagestats-properties-count) |
| [percentileRank](common.md#percentilerank) | `number` | Optional | cannot be null | [Common types](common.md#common-definitions-usagestats-properties-percentilerank) |

#### count

`count`

* is required
* Type: `integer`
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats-properties-count)

**count Type**

`integer`

**count Constraints**

**minimum**: the value of this number must greater than or equal to: `0`

#### percentileRank

`percentileRank`

* is optional
* Type: `number`
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats-properties-percentilerank)

**percentileRank Type**

`number`

**percentileRank Constraints**

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`

### Definitions group usageDetails

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/usageDetails"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [dailyStats](common.md#dailystats) | `object` | Required | cannot be null | [Common types](common.md#common-definitions-usagestats) |
| [weeklyStats](common.md#weeklystats) | `object` | Optional | cannot be null | [Common types](common.md#common-definitions-usagestats) |
| [monthlyStats](common.md#monthlystats) | `object` | Optional | cannot be null | [Common types](common.md#common-definitions-usagestats) |
| [date](common.md#date) | `string` | Required | cannot be null | [Common types](common.md#common-definitions-usagedetails-properties-date) |

#### dailyStats

> Type used to return usage statistics

`dailyStats`

* is required
* Type: `object` \([Details](common.md#common-definitions-usagestats)\)
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats)

**dailyStats Type**

`object` \([Details](common.md#common-definitions-usagestats)\)

#### weeklyStats

> Type used to return usage statistics

`weeklyStats`

* is optional
* Type: `object` \([Details](common.md#common-definitions-usagestats)\)
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats)

**weeklyStats Type**

`object` \([Details](common.md#common-definitions-usagestats)\)

#### monthlyStats

> Type used to return usage statistics

`monthlyStats`

* is optional
* Type: `object` \([Details](common.md#common-definitions-usagestats)\)
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats)

**monthlyStats Type**

`object` \([Details](common.md#common-definitions-usagestats)\)

#### date

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

`date`

* is required
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagedetails-properties-date)

**date Type**

`string`

**date Constraints**

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

### Definitions group profile

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/profile"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [images](common.md#images) | `object` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist) |

#### images

> Links to list of images of varying resolutions/sizes

`images`

* is optional
* Type: `object` \([Details](common.md#common-definitions-imagelist)\)
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist)

**images Type**

`object` \([Details](common.md#common-definitions-imagelist)\)

### Definitions group imageList

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/imageList"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [image](common.md#image) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image) |
| [image24](common.md#image24) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image24) |
| [image32](common.md#image32) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image32) |
| [image48](common.md#image48) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image48) |
| [image72](common.md#image72) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image72) |
| [image192](common.md#image192) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image192) |
| [image512](common.md#image512) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image512) |

#### image

`image`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image)

**image Type**

`string`

**image Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image24

`image24`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image24)

**image24 Type**

`string`

**image24 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image32

`image32`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image32)

**image32 Type**

`string`

**image32 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image48

`image48`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image48)

**image48 Type**

`string`

**image48 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image72

`image72`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image72)

**image72 Type**

`string`

**image72 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image192

`image192`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image192)

**image192 Type**

`string`

**image192 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image512

`image512`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image512)

**image512 Type**

`string`

**image512 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### Definitions group tagLabel

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/tagLabel"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [tagFQN](common.md#tagfqn) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-taglabel-properties-tagfqn) |
| [labelType](common.md#labeltype) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-taglabel-properties-labeltype) |
| [state](common.md#state) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-taglabel-properties-state) |
| [href](common.md#href-1) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-href) |

#### tagFQN

`tagFQN`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-taglabel-properties-tagfqn)

**tagFQN Type**

`string`

**tagFQN Constraints**

**maximum length**: the maximum number of characters for this string is: `45`

#### labelType

`labelType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-taglabel-properties-labeltype)

**labelType Type**

`string`

**labelType Constraints**

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"MANUAL"` |  |
| `"PROPAGATED"` |  |
| `"AUTOMATED"` |  |
| `"DERIVED"` |  |

**labelType Default Value**

The default value is:

```javascript
"MANUAL"
```

#### state

`state`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-taglabel-properties-state)

**state Type**

`string`

**state Constraints**

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"SUGGESTED"` |  |
| `"CONFIRMED"` |  |

**state Default Value**

The default value is:

```javascript
"CONFIRMED"
```

#### href

Link to the tag resource

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-href)

**href Type**

`string`

**href Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-date

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/startDate
```

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### startDate Type

`string`

### startDate Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

## common-definitions-datetime

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/schedule/properties/startDate
```

Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### startDate Type

`string`

### startDate Constraints

**unknown format**: the value of this string must follow the format: `date-Time`

## common-definitions-duration

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/schedule/properties/repeatFrequency
```

Duration in ISO 8601 format in UTC time. Example - 'P23DT23H'

> Jsonschema does not handle ISO 8601 duration yet and hence no format for this type

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### repeatFrequency Type

`string`

## common-definitions-email

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/email
```

Email address of user or other entities

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [user.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json) |

### email Type

`string`

### email Constraints

**maximum length**: the maximum number of characters for this string is: `127`

**minimum length**: the minimum number of characters for this string is: `6`

**pattern**: the string must match the following regular expression:

```text
^\S+@\S+\.\S+$
```

[try pattern](https://regexr.com/?expression=%5E%5CS%2B%40%5CS%2B%5C.%5CS%2B%24)

**email**: the string must be an email address, according to [RFC 5322, section 3.4.1](https://tools.ietf.org/html/rfc5322)

## common-definitions-entityreference-properties-description

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/entityReference/properties/description
```

Optional description of entity

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### description Type

`string`

## common-definitions-entityreference-properties-name

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/entityReference/properties/name
```

Name of the entity instance

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### name Type

`string`

## common-definitions-entityreference-properties-type

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/entityReference/properties/type
```

Entity type/class name - Examples: database, table, metrics, redshift, mysql, bigquery, snowflake...

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### type Type

`string`

## common-definitions-entityreference

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/database
```

Reference to Database that contains this table

> Entity reference that includes entity ID and entity type

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [table.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### database Type

`object` \([Details](common.md#common-definitions-entityreference)\)

## database Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](common.md#id) | `string` | Required | cannot be null | [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-uuid.md) |
| [type](common.md#type) | `string` | Required | cannot be null | [Common types](common.md#common-definitions-entityreference-properties-type) |
| [name](common.md#name) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-entityreference-properties-name) |
| [description](common.md#description) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-entityreference-properties-description) |
| [href](common.md#href) | `string` | Optional | cannot be null | [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-href.md) |

### id

Unique id used to identify an entity

`id`

* is required
* Type: `string`
* cannot be null
* defined in: [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-uuid.md)

#### id Type

`string`

#### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

### type

Entity type/class name - Examples: database, table, metrics, redshift, mysql, bigquery, snowflake...

`type`

* is required
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-entityreference-properties-type)

#### type Type

`string`

### name

Name of the entity instance

`name`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-entityreference-properties-name)

#### name Type

`string`

### description

Optional description of entity

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-entityreference-properties-description)

#### description Type

`string`

### href

Link to the entity resource

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-href.md)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-entityreferencelist

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/followers
```

Followers of this table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### followers Type

`object[]` \([Details](common.md#common-definitions-entityreference)\)

## common-definitions-href

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/tagLabel/properties/href
```

Link to the tag resource

> Link to the resource

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-imagelist-properties-image

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/imageList/properties/image
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### image Type

`string`

### image Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-imagelist-properties-image192

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/imageList/properties/image192
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### image192 Type

`string`

### image192 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-imagelist-properties-image24

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/imageList/properties/image24
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### image24 Type

`string`

### image24 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-imagelist-properties-image32

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/imageList/properties/image32
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### image32 Type

`string`

### image32 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-imagelist-properties-image48

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/imageList/properties/image48
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### image48 Type

`string`

### image48 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-imagelist-properties-image512

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/imageList/properties/image512
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### image512 Type

`string`

### image512 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-imagelist-properties-image72

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/imageList/properties/image72
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### image72 Type

`string`

### image72 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-imagelist

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/profile/properties/images
```

> Links to list of images of varying resolutions/sizes

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### images Type

`object` \([Details](common.md#common-definitions-imagelist)\)

## images Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [image](common.md#image) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image) |
| [image24](common.md#image24) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image24) |
| [image32](common.md#image32) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image32) |
| [image48](common.md#image48) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image48) |
| [image72](common.md#image72) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image72) |
| [image192](common.md#image192) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image192) |
| [image512](common.md#image512) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist-properties-image512) |

### image

`image`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image)

#### image Type

`string`

#### image Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image24

`image24`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image24)

#### image24 Type

`string`

#### image24 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image32

`image32`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image32)

#### image32 Type

`string`

#### image32 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image48

`image48`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image48)

#### image48 Type

`string`

#### image48 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image72

`image72`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image72)

#### image72 Type

`string`

#### image72 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image192

`image192`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image192)

#### image192 Type

`string`

#### image192 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image512

`image512`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist-properties-image512)

#### image512 Type

`string`

#### image512 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-profile

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/profile
```

> Profile of a user, team, or an organization

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [user.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json) |

### profile Type

`object` \([Details](common.md#common-definitions-profile)\)

## profile Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [images](common.md#images) | `object` | Optional | cannot be null | [Common types](common.md#common-definitions-imagelist) |

### images

> Links to list of images of varying resolutions/sizes

`images`

* is optional
* Type: `object` \([Details](common.md#common-definitions-imagelist)\)
* cannot be null
* defined in: [Common types](common.md#common-definitions-imagelist)

#### images Type

`object` \([Details](common.md#common-definitions-imagelist)\)

## common-definitions-schedule

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/ingestionSchedule
```

Schedule for running metadata ingestion jobs

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [databaseService.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json) |

### ingestionSchedule Type

`object` \([Details](common.md#common-definitions-schedule)\)

## ingestionSchedule Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [startDate](common.md#startdate) | `string` | Optional | cannot be null | [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-datetime.md) |
| [repeatFrequency](common.md#repeatfrequency) | `string` | Optional | cannot be null | [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-duration.md) |

### startDate

Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'

`startDate`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-datetime.md)

#### startDate Type

`string`

#### startDate Constraints

**unknown format**: the value of this string must follow the format: `date-Time`

### repeatFrequency

Duration in ISO 8601 format in UTC time. Example - 'P23DT23H'

> Jsonschema does not handle ISO 8601 duration yet and hence no format for this type

`repeatFrequency`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-duration.md)

#### repeatFrequency Type

`string`

## common-definitions-schema

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/schema
```

URL for the schema of an entity

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### schema Type

`string`

### schema Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-taglabel-properties-labeltype

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/tagLabel/properties/labelType
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### labelType Type

`string`

### labelType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"MANUAL"` |  |
| `"PROPAGATED"` |  |
| `"AUTOMATED"` |  |
| `"DERIVED"` |  |

### labelType Default Value

The default value is:

```javascript
"MANUAL"
```

## common-definitions-taglabel-properties-state

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/tagLabel/properties/state
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### state Type

`string`

### state Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"SUGGESTED"` |  |
| `"CONFIRMED"` |  |

### state Default Value

The default value is:

```javascript
"CONFIRMED"
```

## common-definitions-taglabel-properties-tagfqn

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/tagLabel/properties/tagFQN
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### tagFQN Type

`string`

### tagFQN Constraints

**maximum length**: the maximum number of characters for this string is: `45`

## common-definitions-taglabel

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tags/items
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [table.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### items Type

`object` \([Details](common.md#common-definitions-taglabel)\)

## items Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [tagFQN](common.md#tagfqn) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-taglabel-properties-tagfqn) |
| [labelType](common.md#labeltype) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-taglabel-properties-labeltype) |
| [state](common.md#state) | `string` | Optional | cannot be null | [Common types](common.md#common-definitions-taglabel-properties-state) |
| [href](common.md#href) | `string` | Optional | cannot be null | [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-href.md) |

### tagFQN

`tagFQN`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-taglabel-properties-tagfqn)

#### tagFQN Type

`string`

#### tagFQN Constraints

**maximum length**: the maximum number of characters for this string is: `45`

### labelType

`labelType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-taglabel-properties-labeltype)

#### labelType Type

`string`

#### labelType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"MANUAL"` |  |
| `"PROPAGATED"` |  |
| `"AUTOMATED"` |  |
| `"DERIVED"` |  |

#### labelType Default Value

The default value is:

```javascript
"MANUAL"
```

### state

`state`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](common.md#common-definitions-taglabel-properties-state)

#### state Type

`string`

#### state Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"SUGGESTED"` |  |
| `"CONFIRMED"` |  |

#### state Default Value

The default value is:

```javascript
"CONFIRMED"
```

### href

Link to the tag resource

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-href.md)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## common-definitions-timeinterval-properties-end

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/timeInterval/properties/end
```

End unixTimeMillis

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### end Type

`integer`

## common-definitions-timeinterval-properties-start

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/timeInterval/properties/start
```

Start unixTimeMillis

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### start Type

`integer`

## common-definitions-timeinterval

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/timeInterval
```

> Time interval type

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### timeInterval Type

`object` \([Details](common.md#common-definitions-timeinterval)\)

## timeInterval Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [start](common.md#start) | `integer` | Optional | cannot be null | [Common types](common.md#common-definitions-timeinterval-properties-start) |
| [end](common.md#end) | `integer` | Optional | cannot be null | [Common types](common.md#common-definitions-timeinterval-properties-end) |

### start

Start unixTimeMillis

`start`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Common types](common.md#common-definitions-timeinterval-properties-start)

#### start Type

`integer`

### end

End unixTimeMillis

`end`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Common types](common.md#common-definitions-timeinterval-properties-end)

#### end Type

`integer`

## common-definitions-timestamp

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/timestamp
```

> Timestamp type

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### timestamp Type

`string`

### timestamp Constraints

**unknown format**: the value of this string must follow the format: `utc-millisec`

## common-definitions-usagedetails-properties-date

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/usageDetails/properties/date
```

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### date Type

`string`

### date Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

## common-definitions-usagedetails

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/usageSummary
```

Latest usage information for this table

> Type used to return usage details

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [table.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### usageSummary Type

`object` \([Details](common.md#common-definitions-usagedetails)\)

## usageSummary Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [dailyStats](common.md#dailystats) | `object` | Required | cannot be null | [Common types](common.md#common-definitions-usagestats) |
| [weeklyStats](common.md#weeklystats) | `object` | Optional | cannot be null | [Common types](common.md#common-definitions-usagestats) |
| [monthlyStats](common.md#monthlystats) | `object` | Optional | cannot be null | [Common types](common.md#common-definitions-usagestats) |
| [date](common.md#date) | `string` | Required | cannot be null | [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-date.md) |

### dailyStats

> Type used to return usage statistics

`dailyStats`

* is required
* Type: `object` \([Details](common.md#common-definitions-usagestats)\)
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats)

#### dailyStats Type

`object` \([Details](common.md#common-definitions-usagestats)\)

### weeklyStats

> Type used to return usage statistics

`weeklyStats`

* is optional
* Type: `object` \([Details](common.md#common-definitions-usagestats)\)
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats)

#### weeklyStats Type

`object` \([Details](common.md#common-definitions-usagestats)\)

### monthlyStats

> Type used to return usage statistics

`monthlyStats`

* is optional
* Type: `object` \([Details](common.md#common-definitions-usagestats)\)
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats)

#### monthlyStats Type

`object` \([Details](common.md#common-definitions-usagestats)\)

### date

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

`date`

* is required
* Type: `string`
* cannot be null
* defined in: [Common types](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/common-definitions-date.md)

#### date Type

`string`

#### date Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

## common-definitions-usagestats-properties-count

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/usageStats/properties/count
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### count Type

`integer`

### count Constraints

**minimum**: the value of this number must greater than or equal to: `0`

## common-definitions-usagestats-properties-percentilerank

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/usageStats/properties/percentileRank
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### percentileRank Type

`number`

### percentileRank Constraints

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`

## common-definitions-usagestats

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/usageDetails/properties/monthlyStats
```

> Type used to return usage statistics

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Forbidden | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### monthlyStats Type

`object` \([Details](common.md#common-definitions-usagestats)\)

## monthlyStats Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [count](common.md#count) | `integer` | Required | cannot be null | [Common types](common.md#common-definitions-usagestats-properties-count) |
| [percentileRank](common.md#percentilerank) | `number` | Optional | cannot be null | [Common types](common.md#common-definitions-usagestats-properties-percentilerank) |

### count

`count`

* is required
* Type: `integer`
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats-properties-count)

#### count Type

`integer`

#### count Constraints

**minimum**: the value of this number must greater than or equal to: `0`

### percentileRank

`percentileRank`

* is optional
* Type: `number`
* cannot be null
* defined in: [Common types](common.md#common-definitions-usagestats-properties-percentilerank)

#### percentileRank Type

`number`

#### percentileRank Constraints

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`

## common-definitions-uuid

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions/entityReference/properties/id
```

Unique id used to identify an entity

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### id Type

`string`

### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

## common-definitions

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [common.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json) |

### definitions Type

unknown

