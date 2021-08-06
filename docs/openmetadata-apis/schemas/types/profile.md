# Profile Type

## profile

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json
```

Type used to capture profile of a user, team, or an organization

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Allowed | none | [profile.json](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### Type used to capture profile of a user, team, or an organization Type

`object` \([Type used to capture profile of a user, team, or an organization](profile.md)\)

## Type used to capture profile of a user, team, or an organization Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [images](profile.md#images) | `object` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist) |

### images

Links to list of images of varying resolutions/sizes

`images`

* is optional
* Type: `object` \([Details](profile.md#profile-definitions-imagelist)\)
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist)

#### images Type

`object` \([Details](profile.md#profile-definitions-imagelist)\)

## Type used to capture profile of a user, team, or an organization Definitions

### Definitions group imageList

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [image](profile.md#image) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image) |
| [image24](profile.md#image24) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image24) |
| [image32](profile.md#image32) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image32) |
| [image48](profile.md#image48) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image48) |
| [image72](profile.md#image72) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image72) |
| [image192](profile.md#image192) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image192) |
| [image512](profile.md#image512) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image512) |

#### image

`image`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image)

**image Type**

`string`

**image Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image24

`image24`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image24)

**image24 Type**

`string`

**image24 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image32

`image32`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image32)

**image32 Type**

`string`

**image32 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image48

`image48`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image48)

**image48 Type**

`string`

**image48 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image72

`image72`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image72)

**image72 Type**

`string`

**image72 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image192

`image192`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image192)

**image192 Type**

`string`

**image192 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

#### image512

`image512`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image512)

**image512 Type**

`string`

**image512 Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions-imagelist-properties-image

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### image Type

`string`

### image Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions-imagelist-properties-image192

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image192
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### image192 Type

`string`

### image192 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions-imagelist-properties-image24

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image24
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### image24 Type

`string`

### image24 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions-imagelist-properties-image32

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image32
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### image32 Type

`string`

### image32 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions-imagelist-properties-image48

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image48
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### image48 Type

`string`

### image48 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions-imagelist-properties-image512

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image512
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### image512 Type

`string`

### image512 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions-imagelist-properties-image72

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions/imageList/properties/image72
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### image72 Type

`string`

### image72 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions-imagelist

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/properties/images
```

Links to list of images of varying resolutions/sizes

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### images Type

`object` \([Details](profile.md#profile-definitions-imagelist)\)

## images Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [image](profile.md#image) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image) |
| [image24](profile.md#image24) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image24) |
| [image32](profile.md#image32) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image32) |
| [image48](profile.md#image48) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image48) |
| [image72](profile.md#image72) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image72) |
| [image192](profile.md#image192) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image192) |
| [image512](profile.md#image512) | `string` | Optional | cannot be null | [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image512) |

### image

`image`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image)

#### image Type

`string`

#### image Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image24

`image24`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image24)

#### image24 Type

`string`

#### image24 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image32

`image32`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image32)

#### image32 Type

`string`

#### image32 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image48

`image48`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image48)

#### image48 Type

`string`

#### image48 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image72

`image72`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image72)

#### image72 Type

`string`

#### image72 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image192

`image192`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image192)

#### image192 Type

`string`

#### image192 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### image512

`image512`

* is optional
* Type: `string`
* cannot be null
* defined in: [Type used to capture profile of a user, team, or an organization](profile.md#profile-definitions-imagelist-properties-image512)

#### image512 Type

`string`

#### image512 Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## profile-definitions

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [profile.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json) |

### definitions Type

unknown

