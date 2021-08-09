# Tag Categoty Entity

## tagcategory

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json
```

Types related to tag category

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Forbidden | none | [tagCategory.json](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### Types related to tag category Type

`object` \([Types related to tag category](tagcategory.md)\)

## Types related to tag category Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](tagcategory.md#name) | `string` | Required | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-properties-name) |
| [description](tagcategory.md#description) | `string` | Required | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-properties-description) |
| [categoryType](tagcategory.md#categorytype) | `string` | Required | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-properties-categorytype) |
| [href](tagcategory.md#href) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href) |
| [usageCount](tagcategory.md#usagecount) | `integer` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-properties-usagecount) |
| [children](tagcategory.md#children) | `array` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-properties-children) |

### name

Name of the tag

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-properties-name)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `25`

**minimum length**: the minimum number of characters for this string is: `2`

### description

Description of the tag category

`description`

* is required
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-properties-description)

#### description Type

`string`

### categoryType

Type of tag category

`categoryType`

* is required
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-properties-categorytype)

#### categoryType Type

`string`

#### categoryType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Descriptive"` |  |
| `"Classification"` |  |

### href

Link to the resource corresponding to the tag category

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Basic type](../types/basic.md#basic-definitions-href)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### usageCount

Count of how many times the tags from this tag category are used

`usageCount`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-properties-usagecount)

#### usageCount Type

`integer`

### children

Tags under this category

`children`

* is optional
* Type: unknown\[\]
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-properties-children)

#### children Type

unknown\[\]

## Types related to tag category Definitions

### Definitions group tagName

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tagName"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group tagCategoryType

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tagCategoryType"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group tag

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](tagcategory.md#name-1) | `string` | Required | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tagname) |
| [fullyQualifiedName](tagcategory.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-fullyqualifiedname) |
| [description](tagcategory.md#description-1) | `string` | Required | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-description) |
| [href](tagcategory.md#href-1) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href) |
| [usageCount](tagcategory.md#usagecount-1) | `integer` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-usagecount) |
| [deprecated](tagcategory.md#deprecated) | `boolean` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-deprecated) |
| [associatedTags](tagcategory.md#associatedtags) | `array` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-associatedtags) |
| [children](tagcategory.md#children-1) | `array` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-children) |

#### name

Name of the tag

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tagname)

**name Type**

`string`

**name Constraints**

**maximum length**: the maximum number of characters for this string is: `25`

**minimum length**: the minimum number of characters for this string is: `2`

#### fullyQualifiedName

Unique name of the tag of format Category.PrimaryTag.SecondaryTag

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-fullyqualifiedname)

**fullyQualifiedName Type**

`string`

#### description

Unique name of the tag category

`description`

* is required
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-description)

**description Type**

`string`

#### href

Link to the resource corresponding to the tag

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Basic type](../types/basic.md#basic-definitions-href)

**href Type**

`string`

**href Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### usageCount

Count of how many times this tag and children tags are used

`usageCount`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-usagecount)

**usageCount Type**

`integer`

#### deprecated

If the tag is deprecated

`deprecated`

* is optional
* Type: `boolean`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-deprecated)

**deprecated Type**

`boolean`

#### associatedTags

Fully qualified names of tags associated with this tag

`associatedTags`

* is optional
* Type: `string[]`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-associatedtags)

**associatedTags Type**

`string[]`

#### children

Tags under this tag group or empty for tags at leaf level

`children`

* is optional
* Type: `object[]` \([Types related to tag category](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/tagcategory-definitions-tag-properties-children-types-related-to-tag-category.md)\)
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-children)

**children Type**

`object[]` \([Types related to tag category](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/tagcategory-definitions-tag-properties-children-types-related-to-tag-category.md)\)

## tagcategory-definitions-tag-properties-associatedtags-items

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag/properties/associatedTags/items
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### items Type

`string`

## tagcategory-definitions-tag-properties-associatedtags

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag/properties/associatedTags
```

Fully qualified names of tags associated with this tag

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### associatedTags Type

`string[]`

## tagcategory-definitions-tag-properties-children

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag/properties/children
```

Tags under this tag group or empty for tags at leaf level

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### children Type

`object[]` \([Types related to tag category](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/tagcategory-definitions-tag-properties-children-types-related-to-tag-category.md)\)

## tagcategory-definitions-tag-properties-deprecated

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag/properties/deprecated
```

If the tag is deprecated

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### deprecated Type

`boolean`

## tagcategory-definitions-tag-properties-description

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag/properties/description
```

Unique name of the tag category

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### description Type

`string`

## tagcategory-definitions-tag-properties-fullyqualifiedname

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag/properties/fullyQualifiedName
```

Unique name of the tag of format Category.PrimaryTag.SecondaryTag

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### fullyQualifiedName Type

`string`

## tagcategory-definitions-tag-properties-usagecount

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag/properties/usageCount
```

Count of how many times this tag and children tags are used

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### usageCount Type

`integer`

## tagcategory-definitions-tag-properties

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tag/properties
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### properties Type

unknown

## tagcategory-definitions-tag

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/properties/children/items
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Forbidden | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### items Type

unknown

## items Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](tagcategory.md#name) | `string` | Required | cannot be null | [Types related to tag category](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/tagcategory-definitions-tagname.md) |
| [fullyQualifiedName](tagcategory.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-fullyqualifiedname) |
| [description](tagcategory.md#description) | `string` | Required | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-description) |
| [href](tagcategory.md#href) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href) |
| [usageCount](tagcategory.md#usagecount) | `integer` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-usagecount) |
| [deprecated](tagcategory.md#deprecated) | `boolean` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-deprecated) |
| [associatedTags](tagcategory.md#associatedtags) | `array` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-associatedtags) |
| [children](tagcategory.md#children) | `array` | Optional | cannot be null | [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-children) |

### name

Name of the tag

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/tagcategory-definitions-tagname.md)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `25`

**minimum length**: the minimum number of characters for this string is: `2`

### fullyQualifiedName

Unique name of the tag of format Category.PrimaryTag.SecondaryTag

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-fullyqualifiedname)

#### fullyQualifiedName Type

`string`

### description

Unique name of the tag category

`description`

* is required
* Type: `string`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-description)

#### description Type

`string`

### href

Link to the resource corresponding to the tag

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Basic type](../types/basic.md#basic-definitions-href)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### usageCount

Count of how many times this tag and children tags are used

`usageCount`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-usagecount)

#### usageCount Type

`integer`

### deprecated

If the tag is deprecated

`deprecated`

* is optional
* Type: `boolean`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-deprecated)

#### deprecated Type

`boolean`

### associatedTags

Fully qualified names of tags associated with this tag

`associatedTags`

* is optional
* Type: `string[]`
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-associatedtags)

#### associatedTags Type

`string[]`

### children

Tags under this tag group or empty for tags at leaf level

`children`

* is optional
* Type: `object[]` \([Types related to tag category](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/tagcategory-definitions-tag-properties-children-types-related-to-tag-category.md)\)
* cannot be null
* defined in: [Types related to tag category](tagcategory.md#tagcategory-definitions-tag-properties-children)

#### children Type

`object[]` \([Types related to tag category](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/tagcategory-definitions-tag-properties-children-types-related-to-tag-category.md)\)

## tagcategory-definitions-tagcategorytype-javaenums-0

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tagCategoryType/javaEnums/0
```

Tag category used for describing an entity. Example - column is of of type User.Address

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### 0 Type

unknown

## tagcategory-definitions-tagcategorytype-javaenums-1

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions/tagCategoryType/javaEnums/1
```

Tag category used for classifying an entity. Example - column is of of type PII.sensitive

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### 1 Type

unknown

## tagcategory-definitions-tagcategorytype

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/tags/createTagCategory.json#/properties/categoryType
```

Type of tag category

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [createTagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/out/api/tags/createTagCategory.json) |

### categoryType Type

`string`

### categoryType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Descriptive"` |  |
| `"Classification"` |  |

## tagcategory-definitions-tagname

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/tags/createTagCategory.json#/properties/name
```

Name of the tag

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [createTagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/out/api/tags/createTagCategory.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `25`

**minimum length**: the minimum number of characters for this string is: `2`

## tagcategory-definitions

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### definitions Type

unknown

## tagcategory-properties-categorytype

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/properties/categoryType
```

Type of tag category

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### categoryType Type

`string`

### categoryType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Descriptive"` |  |
| `"Classification"` |  |

## tagcategory-properties-children

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/properties/children
```

Tags under this category

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### children Type

unknown\[\]

## tagcategory-properties-description

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/properties/description
```

Description of the tag category

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### description Type

`string`

## tagcategory-properties-name

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/properties/name
```

Name of the tag

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `25`

**minimum length**: the minimum number of characters for this string is: `2`

## tagcategory-properties-usagecount

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json#/properties/usageCount
```

Count of how many times the tags from this tag category are used

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [tagCategory.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json) |

### usageCount Type

`integer`

