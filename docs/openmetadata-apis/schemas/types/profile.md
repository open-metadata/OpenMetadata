# profile

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json
```

Type used to capture profile of a user, team, or an organization

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                               |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [profile.json](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## Type used to capture profile of a user, team, or an organization Type

`object` ([Type used to capture profile of a user, team, or an organization](profile.md))

# Type used to capture profile of a user, team, or an organization Properties

| Property          | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                        |
| :---------------- | :------- | :------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [images](#images) | `object` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/properties/images") |

## images

Links to list of images of varying resolutions/sizes

`images`

*   is optional

*   Type: `object` ([Details](#profile-definitions-imagelist))

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/properties/images")

### images Type

`object` ([Details](#profile-definitions-imagelist))

# Type used to capture profile of a user, team, or an organization Definitions

## Definitions group imageList

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList"}
```

| Property              | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                                                    |
| :-------------------- | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [image](#image)       | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image")       |
| [image24](#image24)   | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image24 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image24")   |
| [image32](#image32)   | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image32 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image32")   |
| [image48](#image48)   | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image48 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image48")   |
| [image72](#image72)   | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image72 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image72")   |
| [image192](#image192) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image192 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image192") |
| [image512](#image512) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image512 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image512") |

### image



`image`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image")

#### image Type

`string`

#### image Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

### image24



`image24`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image24 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image24")

#### image24 Type

`string`

#### image24 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

### image32



`image32`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image32 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image32")

#### image32 Type

`string`

#### image32 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

### image48



`image48`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image48 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image48")

#### image48 Type

`string`

#### image48 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

### image72



`image72`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image72 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image72")

#### image72 Type

`string`

#### image72 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

### image192



`image192`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image192 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image192")

#### image192 Type

`string`

#### image192 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

### image512



`image512`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image512 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image512")

#### image512 Type

`string`

#### image512 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions-imagelist-properties-image

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## image Type

`string`

## image Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions-imagelist-properties-image192

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image192
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## image192 Type

`string`

## image192 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions-imagelist-properties-image24

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image24
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## image24 Type

`string`

## image24 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions-imagelist-properties-image32

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image32
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## image32 Type

`string`

## image32 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions-imagelist-properties-image48

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image48
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## image48 Type

`string`

## image48 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions-imagelist-properties-image512

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image512
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## image512 Type

`string`

## image512 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions-imagelist-properties-image72

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image72
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## image72 Type

`string`

## image72 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions-imagelist

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/properties/images
```

Links to list of images of varying resolutions/sizes

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## images Type

`object` ([Details](#profile-definitions-imagelist))

# images Properties

| Property              | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                                                    |
| :-------------------- | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [image](#image)       | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image")       |
| [image24](#image24)   | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image24 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image24")   |
| [image32](#image32)   | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image32 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image32")   |
| [image48](#image48)   | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image48 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image48")   |
| [image72](#image72)   | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image72 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image72")   |
| [image192](#image192) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image192 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image192") |
| [image512](#image512) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image512 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image512") |

## image



`image`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image")

### image Type

`string`

### image Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## image24



`image24`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image24 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image24")

### image24 Type

`string`

### image24 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## image32



`image32`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image32 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image32")

### image32 Type

`string`

### image32 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## image48



`image48`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image48 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image48")

### image48 Type

`string`

### image48 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## image72



`image72`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image72 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image72")

### image72 Type

`string`

### image72 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## image192



`image192`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image192 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image192")

### image192 Type

`string`

### image192 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## image512



`image512`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used to capture profile of a user, team, or an organization](#profile-definitions-imagelist-properties-image512 "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image512")

### image512 Type

`string`

### image512 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# profile-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [profile.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/type/profile.json "open original schema") |

## definitions Type

unknown
