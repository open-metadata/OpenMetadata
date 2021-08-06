# Collection Descriptor Type

## collectiondescriptor

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json
```

Type used for capturing the details of a collection

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Allowed | none | [collectionDescriptor.json](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json) |

### Schema for collection descriptor Type

`object` \([Schema for collection descriptor](collectiondescriptor.md)\)

## Schema for collection descriptor Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [collection](collectiondescriptor.md#collection) | `object` | Optional | cannot be null | [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo) |

### collection

Collection Info

`collection`

* is optional
* Type: `object` \([Details](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo)\)
* cannot be null
* defined in: [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo)

#### collection Type

`object` \([Details](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo)\)

## Schema for collection descriptor Definitions

### Definitions group collectionInfo

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](collectiondescriptor.md#name) | `string` | Optional | cannot be null | [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-name) |
| [documentation](collectiondescriptor.md#documentation) | `string` | Optional | cannot be null | [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-documentation) |
| [href](collectiondescriptor.md#href) | `string` | Optional | cannot be null | [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-href) |
| [images](collectiondescriptor.md#images) | `object` | Optional | cannot be null | [Profile type](profile.md#profile-definitions-imagelist) |

#### name

Unique name that identifies a collection

`name`

* is optional
* Type: `string`
* cannot be null
* defined in: [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-name)

**name Type**

`string`

#### documentation

Description of collection

`documentation`

* is optional
* Type: `string`
* cannot be null
* defined in: [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-documentation)

**documentation Type**

`string`

#### href

URL of the API endpoint where given collections are available

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-href)

**href Type**

`string`

**href Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### images

Links to list of images of varying resolutions/sizes

`images`

* is optional
* Type: `object` \([Details](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/types/profile-definitions-imagelist.md)\)
* cannot be null
* defined in: [Profile type](profile.md#profile-definitions-imagelist)

**images Type**

`object` \([Details](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/types/profile-definitions-imagelist.md)\)

## collectiondescriptor-definitions-collectioninfo-properties-documentation

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/documentation
```

Description of collection

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [collectionDescriptor.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json) |

### documentation Type

`string`

## collectiondescriptor-definitions-collectioninfo-properties-href

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/href
```

URL of the API endpoint where given collections are available

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [collectionDescriptor.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json) |

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## collectiondescriptor-definitions-collectioninfo-properties-name

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/name
```

Unique name that identifies a collection

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [collectionDescriptor.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json) |

### name Type

`string`

## collectiondescriptor-definitions-collectioninfo

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/properties/collection
```

Collection Info

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [collectionDescriptor.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json) |

### collection Type

`object` \([Details](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo)\)

## collection Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](collectiondescriptor.md#name) | `string` | Optional | cannot be null | [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-name) |
| [documentation](collectiondescriptor.md#documentation) | `string` | Optional | cannot be null | [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-documentation) |
| [href](collectiondescriptor.md#href) | `string` | Optional | cannot be null | [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-href) |
| [images](collectiondescriptor.md#images) | `object` | Optional | cannot be null | [Profile type](profile.md#profile-definitions-imagelist) |

### name

Unique name that identifies a collection

`name`

* is optional
* Type: `string`
* cannot be null
* defined in: [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-name)

#### name Type

`string`

### documentation

Description of collection

`documentation`

* is optional
* Type: `string`
* cannot be null
* defined in: [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-documentation)

#### documentation Type

`string`

### href

URL of the API endpoint where given collections are available

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Schema for collection descriptor](collectiondescriptor.md#collectiondescriptor-definitions-collectioninfo-properties-href)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### images

Links to list of images of varying resolutions/sizes

`images`

* is optional
* Type: `object` \([Details](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/types/profile-definitions-imagelist.md)\)
* cannot be null
* defined in: [Profile type](profile.md#profile-definitions-imagelist)

#### images Type

`object` \([Details](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/types/profile-definitions-imagelist.md)\)

## collectiondescriptor-definitions

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [collectionDescriptor.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json) |

### definitions Type

unknown

