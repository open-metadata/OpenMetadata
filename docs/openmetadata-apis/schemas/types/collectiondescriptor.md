# collectiondescriptor

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json
```

Type used for capturing the details of a collection

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                         |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [collectionDescriptor.json](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json "open original schema") |

## Schema for collection descriptor Type

`object` ([Schema for collection descriptor](collectiondescriptor.md))

# Schema for collection descriptor Properties

| Property                  | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                 |
| :------------------------ | :------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [collection](#collection) | `object` | Optional | cannot be null | [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/properties/collection") |

## collection

Collection Info

`collection`

*   is optional

*   Type: `object` ([Details](#collectiondescriptor-definitions-collectioninfo))

*   cannot be null

*   defined in: [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/properties/collection")

### collection Type

`object` ([Details](#collectiondescriptor-definitions-collectioninfo))

# Schema for collection descriptor Definitions

## Definitions group collectionInfo

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo"}
```

| Property                        | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                                                        |
| :------------------------------ | :------- | :------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [name](#name)                   | `string` | Optional | cannot be null | [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-name "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/name")                   |
| [documentation](#documentation) | `string` | Optional | cannot be null | [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-documentation "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/documentation") |
| [href](#href)                   | `string` | Optional | cannot be null | [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-href "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/href")                   |
| [images](#images)               | `object` | Optional | cannot be null | [Profile type](../types/profile.md#profile-definitions-imagelist)                                                   |

### name

Unique name that identifies a collection

`name`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-name "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/name")

#### name Type

`string`

### documentation

Description of collection

`documentation`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-documentation "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/documentation")

#### documentation Type

`string`

### href

URL of the API endpoint where given collections are available

`href`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-href "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/href")

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

### images

Links to list of images of varying resolutions/sizes

`images`

*   is optional

*   Type: `object` ([Details](profile-definitions-imagelist.md))

*   cannot be null

*   defined in: [Profile type](../types/profile.md#profile-definitions-imagelist)

#### images Type

`object` ([Details](profile-definitions-imagelist.md))
# collectiondescriptor-definitions-collectioninfo-properties-documentation

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/documentation
```

Description of collection

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                          |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [collectionDescriptor.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json "open original schema") |

## documentation Type

`string`
# collectiondescriptor-definitions-collectioninfo-properties-href

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/href
```

URL of the API endpoint where given collections are available

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                          |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [collectionDescriptor.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json "open original schema") |

## href Type

`string`

## href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# collectiondescriptor-definitions-collectioninfo-properties-name

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/name
```

Unique name that identifies a collection

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                          |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [collectionDescriptor.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json "open original schema") |

## name Type

`string`
# collectiondescriptor-definitions-collectioninfo

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/properties/collection
```

Collection Info

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                          |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [collectionDescriptor.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json "open original schema") |

## collection Type

`object` ([Details](#collectiondescriptor-definitions-collectioninfo))

# collection Properties

| Property                        | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                                                        |
| :------------------------------ | :------- | :------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [name](#name)                   | `string` | Optional | cannot be null | [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-name "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/name")                   |
| [documentation](#documentation) | `string` | Optional | cannot be null | [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-documentation "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/documentation") |
| [href](#href)                   | `string` | Optional | cannot be null | [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-href "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/href")                   |
| [images](#images)               | `object` | Optional | cannot be null | [Profile type](../types/profile.md#profile-definitions-imagelist)                                                   |

## name

Unique name that identifies a collection

`name`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-name "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/name")

### name Type

`string`

## documentation

Description of collection

`documentation`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-documentation "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/documentation")

### documentation Type

`string`

## href

URL of the API endpoint where given collections are available

`href`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Schema for collection descriptor](#collectiondescriptor-definitions-collectioninfo-properties-href "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions/collectionInfo/properties/href")

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## images

Links to list of images of varying resolutions/sizes

`images`

*   is optional

*   Type: `object` ([Details](profile-definitions-imagelist.md))

*   cannot be null

*   defined in: [Profile type](../types/profile.md#profile-definitions-imagelist)

### images Type

`object` ([Details](profile-definitions-imagelist.md))
# collectiondescriptor-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                          |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [collectionDescriptor.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json "open original schema") |

## definitions Type

unknown
