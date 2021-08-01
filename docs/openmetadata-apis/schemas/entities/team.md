# Team Entity

## team

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json
```

Team entity

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [team.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json) |

### Team entity Type

`object` \([Team entity](team.md)\)

## Team entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](team.md#id) | `string` | Required | cannot be null | [Common type](../types/common.md#common-definitions-uuid) |
| [name](team.md#name) | `string` | Required | cannot be null | [Team entity](team.md#team-properties-name) |
| [displayName](team.md#displayname) | `string` | Optional | cannot be null | [Team entity](team.md#team-properties-displayname) |
| [description](team.md#description) | `string` | Optional | cannot be null | [Team entity](team.md#team-properties-description) |
| [href](team.md#href) | `string` | Required | cannot be null | [Common type](../types/common.md#common-definitions-href) |
| [profile](team.md#profile) | `object` | Optional | cannot be null | [Common type](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/Common/common-definitions-profile.md#common-definitions-profile) |
| [deleted](team.md#deleted) | `boolean` | Optional | cannot be null | [Team entity](team.md#team-properties-deleted) |
| [users](team.md#users) | `array` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-entityreferencelist) |
| [owns](team.md#owns) | `array` | Optional | cannot be null | [Common type](../types/common.md#common-definitions-entityreferencelist) |

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

### name

Unique name of the team typically the team ID from the identify provider. Example - group Id from ldap.

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Team entity](team.md#team-properties-name)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

### displayName

Name used for display purposes. Example 'Data Science team'

`displayName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Team entity](team.md#team-properties-displayname)

#### displayName Type

`string`

### description

Description of the team

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Team entity](team.md#team-properties-description)

#### description Type

`string`

### href

Link to the resource corresponding to this entity

> Link to the resource

`href`

* is required
* Type: `string`
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-href)

#### href Type

`string`

#### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### profile

Team profile information

> Profile of a user, team, or an organization

`profile`

* is optional
* Type: `object` \([Details](../types/common.md#common-definitions-profile)\)
* cannot be null
* defined in: [Common type](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/Common/common-definitions-profile.md#common-definitions-profile)

#### profile Type

`object` \([Details](../types/common.md#common-definitions-profile)\)

### deleted

`deleted`

* is optional
* Type: `boolean`
* cannot be null
* defined in: [Team entity](team.md#team-properties-deleted)

#### deleted Type

`boolean`

### users

Users that are part of the team

`users`

* is optional
* Type: `object[]` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreferencelist)

#### users Type

`object[]` \([Details](../types/common.md#common-definitions-entityreference)\)

### owns

Entities owned by the team

`owns`

* is optional
* Type: `object[]` \([Details](../types/common.md#common-definitions-entityreference)\)
* cannot be null
* defined in: [Common type](../types/common.md#common-definitions-entityreferencelist)

#### owns Type

`object[]` \([Details](../types/common.md#common-definitions-entityreference)\)

## team-defintions-teamname

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/defintions/teamName
```

Unique name of the team typically the team ID from the identify provider. Example - group Id from ldap.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [team.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json) |

### teamName Type

`string`

### teamName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## team-defintions

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/defintions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [team.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json) |

### defintions Type

unknown

## team-properties-deleted

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/deleted
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [team.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json) |

### deleted Type

`boolean`

## team-properties-description

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/description
```

Description of the team

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [team.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json) |

### description Type

`string`

## team-properties-displayname

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/displayName
```

Name used for display purposes. Example 'Data Science team'

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [team.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json) |

### displayName Type

`string`

## team-properties-name

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/name
```

Unique name of the team typically the team ID from the identify provider. Example - group Id from ldap.

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [team.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

