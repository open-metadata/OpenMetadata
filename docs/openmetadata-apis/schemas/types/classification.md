# Classiication Type

## classification

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json
```

Data classification related types

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Allowed | none | [classification.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json) |

### Data classification related types Type

`object` \([Data classification related types](classification.md)\)

## Data classification related types Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [tags](classification.md#tags) | `array` | Optional | cannot be null | [Data classification related types](classification.md#classification-properties-tags) |

### tags

`tags`

* is optional
* Type: `object[]` \([Details](classification.md#classification-definitions-personaldata)\)
* cannot be null
* defined in: [Data classification related types](classification.md#classification-properties-tags)

#### tags Type

`object[]` \([Details](classification.md#classification-definitions-personaldata)\)

## Data classification related types Definitions

### Definitions group personalData

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json#/definitions/personalData"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](classification.md#name) | `string` | Optional | cannot be null | [Data classification related types](classification.md#classification-definitions-personaldata-properties-name) |
| [documentation](classification.md#documentation) | `string` | Optional | cannot be null | [Data classification related types](classification.md#classification-definitions-personaldata-properties-documentation) |
| [piiType](classification.md#piitype) | `string` | Optional | cannot be null | [Data classification related types](classification.md#classification-definitions-personaldata-properties-piitype) |
| [personalDataType](classification.md#personaldatatype) | `string` | Optional | cannot be null | [Data classification related types](classification.md#classification-definitions-personaldata-properties-personaldatatype) |

#### name

Name of PII tag

`name`

* is optional
* Type: `string`
* cannot be null
* defined in: [Data classification related types](classification.md#classification-definitions-personaldata-properties-name)

**name Type**

`string`

#### documentation

Name of PII tag

`documentation`

* is optional
* Type: `string`
* cannot be null
* defined in: [Data classification related types](classification.md#classification-definitions-personaldata-properties-documentation)

**documentation Type**

`string`

#### piiType

PII tag type

`piiType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Data classification related types](classification.md#classification-definitions-personaldata-properties-piitype)

**piiType Type**

`string`

**piiType Constraints**

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NONE"` |  |
| `"NON_SENSITIVE"` |  |
| `"SENSITIVE"` |  |

#### personalDataType

Personal data tag type

`personalDataType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Data classification related types](classification.md#classification-definitions-personaldata-properties-personaldatatype)

**personalDataType Type**

`string`

**personalDataType Constraints**

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"PERSONAL"` |  |
| `"SPECIAL_CATEGORY"` |  |

## classification-definitions-personaldata-properties-documentation

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json#/definitions/personalData/properties/documentation
```

Name of PII tag

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [classification.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json) |

### documentation Type

`string`

## classification-definitions-personaldata-properties-name

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json#/definitions/personalData/properties/name
```

Name of PII tag

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [classification.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json) |

### name Type

`string`

## classification-definitions-personaldata-properties-personaldatatype

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json#/definitions/personalData/properties/personalDataType
```

Personal data tag type

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [classification.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json) |

### personalDataType Type

`string`

### personalDataType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"PERSONAL"` |  |
| `"SPECIAL_CATEGORY"` |  |

## classification-definitions-personaldata-properties-piitype

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json#/definitions/personalData/properties/piiType
```

PII tag type

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [classification.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json) |

### piiType Type

`string`

### piiType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NONE"` |  |
| `"NON_SENSITIVE"` |  |
| `"SENSITIVE"` |  |

## classification-definitions-personaldata

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json#/properties/tags/items
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [classification.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json) |

### items Type

`object` \([Details](classification.md#classification-definitions-personaldata)\)

## items Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](classification.md#name) | `string` | Optional | cannot be null | [Data classification related types](classification.md#classification-definitions-personaldata-properties-name) |
| [documentation](classification.md#documentation) | `string` | Optional | cannot be null | [Data classification related types](classification.md#classification-definitions-personaldata-properties-documentation) |
| [piiType](classification.md#piitype) | `string` | Optional | cannot be null | [Data classification related types](classification.md#classification-definitions-personaldata-properties-piitype) |
| [personalDataType](classification.md#personaldatatype) | `string` | Optional | cannot be null | [Data classification related types](classification.md#classification-definitions-personaldata-properties-personaldatatype) |

### name

Name of PII tag

`name`

* is optional
* Type: `string`
* cannot be null
* defined in: [Data classification related types](classification.md#classification-definitions-personaldata-properties-name)

#### name Type

`string`

### documentation

Name of PII tag

`documentation`

* is optional
* Type: `string`
* cannot be null
* defined in: [Data classification related types](classification.md#classification-definitions-personaldata-properties-documentation)

#### documentation Type

`string`

### piiType

PII tag type

`piiType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Data classification related types](classification.md#classification-definitions-personaldata-properties-piitype)

#### piiType Type

`string`

#### piiType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NONE"` |  |
| `"NON_SENSITIVE"` |  |
| `"SENSITIVE"` |  |

### personalDataType

Personal data tag type

`personalDataType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Data classification related types](classification.md#classification-definitions-personaldata-properties-personaldatatype)

#### personalDataType Type

`string`

#### personalDataType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"PERSONAL"` |  |
| `"SPECIAL_CATEGORY"` |  |

## classification-definitions

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [classification.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json) |

### definitions Type

unknown

## classification-properties-tags

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json#/properties/tags
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [classification.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json) |

### tags Type

`object[]` \([Details](classification.md#classification-definitions-personaldata)\)

