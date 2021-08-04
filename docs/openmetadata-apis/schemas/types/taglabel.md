# taglabel

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json
```

Type used for schedule with start time and repeat frequency

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                 |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [tagLabel.json](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json "open original schema") |

## Tag Label Type

`object` ([Tag Label](taglabel.md))

# Tag Label Properties

| Property                | Type     | Required | Nullable       | Defined by                                                                                                                                                                                           |
| :---------------------- | :------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tagFQN](#tagfqn)       | `string` | Optional | cannot be null | [Tag Label](#taglabel-properties-tagfqn "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/tagFQN")       |
| [labelType](#labeltype) | `string` | Optional | cannot be null | [Tag Label](#taglabel-properties-labeltype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/labelType") |
| [state](#state)         | `string` | Optional | cannot be null | [Tag Label](#taglabel-properties-state "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/state")         |
| [href](#href)           | `string` | Optional | cannot be null | [Tag Label](basic-definitions-href.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/href")             |

## tagFQN



`tagFQN`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Tag Label](#taglabel-properties-tagfqn "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/tagFQN")

### tagFQN Type

`string`

### tagFQN Constraints

**maximum length**: the maximum number of characters for this string is: `45`

## labelType



`labelType`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Tag Label](#taglabel-properties-labeltype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/labelType")

### labelType Type

`string`

### labelType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value          | Explanation |
| :------------- | :---------- |
| `"Manual"`     |             |
| `"Propagated"` |             |
| `"Automated"`  |             |
| `"Derived"`    |             |

### labelType Default Value

The default value is:

```json
"Manual"
```

## state



`state`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Tag Label](#taglabel-properties-state "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/state")

### state Type

`string`

### state Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value         | Explanation |
| :------------ | :---------- |
| `"Suggested"` |             |
| `"Confirmed"` |             |

### state Default Value

The default value is:

```json
"Confirmed"
```

## href

Link to the tag resource

> Link to the resource

`href`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Tag Label](basic-definitions-href.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/href")

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# taglabel-properties-labeltype

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/labelType
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [tagLabel.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json "open original schema") |

## labelType Type

`string`

## labelType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value          | Explanation |
| :------------- | :---------- |
| `"Manual"`     |             |
| `"Propagated"` |             |
| `"Automated"`  |             |
| `"Derived"`    |             |

## labelType Default Value

The default value is:

```json
"Manual"
```
# taglabel-properties-state

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/state
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [tagLabel.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json "open original schema") |

## state Type

`string`

## state Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value         | Explanation |
| :------------ | :---------- |
| `"Suggested"` |             |
| `"Confirmed"` |             |

## state Default Value

The default value is:

```json
"Confirmed"
```
# taglabel-properties-tagfqn

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json#/properties/tagFQN
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [tagLabel.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json "open original schema") |

## tagFQN Type

`string`

## tagFQN Constraints

**maximum length**: the maximum number of characters for this string is: `45`
