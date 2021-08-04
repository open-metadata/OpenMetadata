# thread

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json
```

Entity that represents a feed

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                    |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [thread.json](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json "open original schema") |

## Feed entity Type

`object` ([Feed entity](thread.md))

# Feed entity Properties

| Property                    | Type          | Required | Nullable       | Defined by                                                                                                                                                                                                             |
| :-------------------------- | :------------ | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#id)                   | `string`      | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                |
| [href](#href)               | `string`      | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href)              |
| [threadTs](#threadts)       | Not specified | Optional | cannot be null | [Feed entity](#thread-Properties-Threads "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/threadTs")      |
| [about](#about)             | `string`      | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-entitylink)       |
| [addressedTo](#addressedto) | `string`      | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-entitylink) |
| [posts](#posts)             | `array`       | Required | cannot be null | [Feed entity](#thread-Properties-Posts "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/posts")            |

## id

Unique id used to identify an entity

`id`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-uuid)

### id Type

`string`

### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122 "check the specification")

## href

Link to the resource corresponding to this entity

> Link to the resource

`href`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-href)

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## threadTs

Timestamp of the when the first post created the thread

`threadTs`

*   is optional

*   Type: unknown

*   cannot be null

*   defined in: [Feed entity](#thread-Properties-Threads "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/threadTs")

### threadTs Type

unknown

### threadTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")

## about

Entity or field thread is created for with format <#E/{enties}/{entityName}/{field}/{fieldValue}

`about`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-entitylink)

### about Type

`string`

### about Constraints

**pattern**: the string must match the following regular expression: 

```regexp
^<#E/\S+/\S+>$
```

[try pattern](https://regexr.com/?expression=%5E%3C%23E%2F%5CS%2B%2F%5CS%2B%3E%24 "try regular expression with regexr.com")

## addressedTo

Entity or field thread is created for with format <#E/{enties}/{entityName}/{field}/{fieldValue}

`addressedTo`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-entitylink)

### addressedTo Type

`string`

### addressedTo Constraints

**pattern**: the string must match the following regular expression: 

```regexp
^<#E/\S+/\S+>$
```

[try pattern](https://regexr.com/?expression=%5E%3C%23E%2F%5CS%2B%2F%5CS%2B%3E%24 "try regular expression with regexr.com")

## posts



`posts`

*   is required

*   Type: `object[]` ([Details](#thread-definitions-post))

*   cannot be null

*   defined in: [Feed entity](#thread-Properties-Posts "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/posts")

### posts Type

`object[]` ([Details](#thread-definitions-post))

# Feed entity Definitions

## Definitions group post

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post"}
```

| Property            | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                        |
| :------------------ | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [message](#message) | `string` | Required | cannot be null | [Feed entity](#thread-definitions-post-properties-message "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/message") |
| [postTs](#postts)   | `string` | Optional | cannot be null | [Feed entity](#thread-definitions-post-properties-postts "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/postTs")   |
| [from](#from)       | `string` | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                        |

### message

Message in markdown format. See markdown support for more details.

`message`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Feed entity](#thread-definitions-post-properties-message "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/message")

#### message Type

`string`

### postTs

Timestamp of the post

`postTs`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Feed entity](#thread-definitions-post-properties-postts "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/postTs")

#### postTs Type

`string`

#### postTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")

### from

Unique id used to identify an entity

`from`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-uuid)

#### from Type

`string`

#### from Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122 "check the specification")
# thread-definitions-post-properties-message

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/message
```

Message in markdown format. See markdown support for more details.

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                     |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [thread.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json "open original schema") |

## message Type

`string`
# thread-definitions-post-properties-postts

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/postTs
```

Timestamp of the post

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                     |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [thread.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json "open original schema") |

## postTs Type

`string`

## postTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")
# thread-definitions-post

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/posts/items
```

Post within a feed

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                     |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [thread.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json "open original schema") |

## items Type

`object` ([Details](#thread-definitions-post))

# items Properties

| Property            | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                        |
| :------------------ | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [message](#message) | `string` | Required | cannot be null | [Feed entity](#thread-definitions-post-properties-message "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/message") |
| [postTs](#postts)   | `string` | Optional | cannot be null | [Feed entity](#thread-definitions-post-properties-postts "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/postTs")   |
| [from](#from)       | `string` | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                        |

## message

Message in markdown format. See markdown support for more details.

`message`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Feed entity](#thread-definitions-post-properties-message "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/message")

### message Type

`string`

## postTs

Timestamp of the post

`postTs`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Feed entity](#thread-definitions-post-properties-postts "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/postTs")

### postTs Type

`string`

### postTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")

## from

Unique id used to identify an entity

`from`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-uuid)

### from Type

`string`

### from Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122 "check the specification")
# thread-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                     |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [thread.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json "open original schema") |

## definitions Type

unknown
# thread-properties-posts

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/posts
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                     |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [thread.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json "open original schema") |

## posts Type

`object[]` ([Details](#thread-definitions-post))
# thread-properties-threadts

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/threadTs
```

Timestamp of the when the first post created the thread

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                     |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [thread.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json "open original schema") |

## threadTs Type

unknown

## threadTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")
