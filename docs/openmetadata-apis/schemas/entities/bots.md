# Bot Entity

## bots

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json
```

Bot entity to capture the details of a bot

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [bots.json](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json) |

### Bot entity Type

`object` \([Bot entity](bots.md)\)

## Bot entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](bots.md#id) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid) |
| [name](bots.md#name) | `string` | Optional | cannot be null | [Bot entity](bots.md#bots-properties-name) |
| [displayName](bots.md#displayname) | `string` | Optional | cannot be null | [Bot entity](bots.md#bots-properties-displayname) |
| [description](bots.md#description) | `string` | Optional | cannot be null | [Bot entity](bots.md#bots-properties-description) |
| [href](bots.md#href) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href) |

### id

Unique id used to identify an entity

`id`

* is optional
* Type: `string`
* cannot be null
* defined in: [Basic type](../types/basic.md#basic-definitions-uuid)

#### id Type

`string`

#### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122)

### name

Optional name that identifies this entity. Same as id if name is not available

`name`

* is optional
* Type: `string`
* cannot be null
* defined in: [Bot entity](bots.md#bots-properties-name)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

### displayName

Name used for display purposes. Example 'FirstName LastName'

`displayName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Bot entity](bots.md#bots-properties-displayname)

#### displayName Type

`string`

### description

Description of entity instance.

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Bot entity](bots.md#bots-properties-description)

#### description Type

`string`

### href

Link to the resource corresponding to this entity

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

## bots-properties-description

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json#/properties/description
```

Description of entity instance.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [bots.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json) |

### description Type

`string`

## bots-properties-displayname

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json#/properties/displayName
```

Name used for display purposes. Example 'FirstName LastName'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [bots.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json) |

### displayName Type

`string`

## bots-properties-name

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json#/properties/name
```

Optional name that identifies this entity. Same as id if name is not available

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [bots.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

