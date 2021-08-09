# Tag Label Type

## taglabel

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json
```

Type used for schedule with start time and repeat frequency

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [tagLabel.json](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json) |

### Tag Label Type

`object` \([Tag Label](taglabel.md)\)

## Tag Label Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [tagFQN](taglabel.md#tagfqn) | `string` | Optional | cannot be null | [Tag Label](taglabel.md#taglabel-properties-tagfqn) |
| [labelType](taglabel.md#labeltype) | `string` | Optional | cannot be null | [Tag Label](taglabel.md#taglabel-properties-labeltype) |
| [state](taglabel.md#state) | `string` | Optional | cannot be null | [Tag Label](taglabel.md#taglabel-properties-state) |
| [href](taglabel.md#href) | `string` | Optional | cannot be null | [Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/types/basic-definitions-href.md) |

### tagFQN

`tagFQN`

* is optional
* Type: `string`
* cannot be null
* defined in: [Tag Label](taglabel.md#taglabel-properties-tagfqn)

#### tagFQN Type

`string`

#### tagFQN Constraints

**maximum length**: the maximum number of characters for this string is: `45`

### labelType

`labelType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Tag Label](taglabel.md#taglabel-properties-labeltype)

#### labelType Type

`string`

#### labelType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Manual"` |  |
| `"Propagated"` |  |
| `"Automated"` |  |
| `"Derived"` |  |

#### labelType Default Value

The default value is:

```javascript
"Manual"
```

### state

`state`

* is optional
* Type: `string`
* cannot be null
* defined in: [Tag Label](taglabel.md#taglabel-properties-state)

#### state Type

`string`

#### state Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Suggested"` |  |
| `"Confirmed"` |  |

#### state Default Value

The default value is:

```javascript
"Confirmed"
```

### href

Link to the tag resource

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/types/basic-definitions-href.md)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## taglabel-properties-labeltype

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/labelType
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagLabel.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json) |

### labelType Type

`string`

### labelType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Manual"` |  |
| `"Propagated"` |  |
| `"Automated"` |  |
| `"Derived"` |  |

### labelType Default Value

The default value is:

```javascript
"Manual"
```

## taglabel-properties-state

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/state
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagLabel.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json) |

### state Type

`string`

### state Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Suggested"` |  |
| `"Confirmed"` |  |

### state Default Value

The default value is:

```javascript
"Confirmed"
```

## taglabel-properties-tagfqn

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/tagFQN
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagLabel.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json) |

### tagFQN Type

`string`

### tagFQN Constraints

**maximum length**: the maximum number of characters for this string is: `45`

