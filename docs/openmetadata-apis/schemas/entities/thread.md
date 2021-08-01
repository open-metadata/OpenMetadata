# Feed Entity

## thread

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json
```

Entity that represents a feed

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Allowed | none | [thread.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json) |

### Feed entity Type

`object` \([Feed entity](thread.md)\)

## Feed entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](thread.md#id) | `string` | Required | cannot be null | [Common type](../types/common.md#common-definitions-uuid) |
| [href](thread.md#href) | `string` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-href) |
| [threadTs](thread.md#threadts) | Not specified | Optional | cannot be null | [Feed entity](thread.md#Thread-Properties-Threads) |
| [toEntity](thread.md#toentity) | `object` | Required | cannot be null | [Common type](../types/common.md#common-definitions-entityreference) |
| [posts](thread.md#posts) | `array` | Required | cannot be null | [Feed entity](thread.md#Thread-Properties-Posts) |

### id

Unique id used to identify an entity

`id`

* is required
* Type: `string`
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-uuid)

#### id Type

`string`

#### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

### href

Link to the resource corresponding to this entity

> Link to the resource

`href`

* is optional
* Type: `string`
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-href)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### threadTs

Timestamp of the when the first post created the thread

`threadTs`

* is optional
* Type: unknown
* cannot be null
* defined in: [Feed entity](thread.md#Thread-Properties-Threads)

#### threadTs Type

unknown

#### threadTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

### toEntity

Entity for which this thread is created

> Entity reference that includes entity ID and entity type

`toEntity`

* is required
* Type: `object` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreference)

#### toEntity Type

`object` \([Details](../types/common.md#common-definitions-entityreference)\)

### posts

`posts`

* is required
* Type: `object[]` \([Details](thread.md#thread-definitions-post)\)
* cannot be null
* defined in: [Feed entity](thread.md#Thread-Properties-Posts)

#### posts Type

`object[]` \([Details](thread.md#thread-definitions-post)\)

## Feed entity Definitions

### Definitions group post

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [message](thread.md#message) | `string` | Required | cannot be null | [Feed entity](thread.md#thread-definitions-post-properties-message) |
| [postTs](thread.md#postts) | `string` | Optional | cannot be null | [Feed entity](thread.md#thread-definitions-post-properties-postts) |
| [from](thread.md#from) | `string` | Required | cannot be null | [Feed entity](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/entities/common-definitions-uuid.md) |

#### message

Message in the post

`message`

* is required
* Type: `string`
* cannot be null
* defined in: [Feed entity](thread.md#thread-definitions-post-properties-message)

**message Type**

`string`

#### postTs

Timestamp of the post

`postTs`

* is optional
* Type: `string`
* cannot be null
* defined in: [Feed entity](thread.md#thread-definitions-post-properties-postts)

**postTs Type**

`string`

**postTs Constraints**

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

#### from

Unique id used to identify an entity

`from`

* is required
* Type: `string`
* cannot be null
* defined in: [Feed entity](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/entities/common-definitions-uuid.md)

**from Type**

`string`

**from Constraints**

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

## thread-definitions-post-properties-message

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/message
```

Message in the post

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [thread.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json) |

### message Type

`string`

## thread-definitions-post-properties-postts

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions/post/properties/postTs
```

Timestamp of the post

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [thread.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json) |

### postTs Type

`string`

### postTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

## thread-definitions-post

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/posts/items
```

Post within a feed

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [thread.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json) |

### items Type

`object` \([Details](thread.md#thread-definitions-post)\)

## items Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [message](thread.md#message) | `string` | Required | cannot be null | [Feed entity](thread.md#thread-definitions-post-properties-message) |
| [postTs](thread.md#postts) | `string` | Optional | cannot be null | [Feed entity](thread.md#thread-definitions-post-properties-postts) |
| [from](thread.md#from) | `string` | Required | cannot be null | [Feed entity](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/entities/common-definitions-uuid.md) |

### message

Message in the post

`message`

* is required
* Type: `string`
* cannot be null
* defined in: [Feed entity](thread.md#thread-definitions-post-properties-message)

#### message Type

`string`

### postTs

Timestamp of the post

`postTs`

* is optional
* Type: `string`
* cannot be null
* defined in: [Feed entity](thread.md#thread-definitions-post-properties-postts)

#### postTs Type

`string`

#### postTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

### from

Unique id used to identify an entity

`from`

* is required
* Type: `string`
* cannot be null
* defined in: [Feed entity](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/entities/common-definitions-uuid.md)

#### from Type

`string`

#### from Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

## thread-definitions

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [thread.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json) |

### definitions Type

unknown

## thread-properties-posts

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/posts
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [thread.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json) |

### posts Type

`object[]` \([Details](thread.md#thread-definitions-post)\)

## thread-properties-threadts

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json#/properties/threadTs
```

Timestamp of the when the first post created the thread

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [thread.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json) |

### threadTs Type

unknown

### threadTs Constraints

**date time**: the string must be a date time string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

