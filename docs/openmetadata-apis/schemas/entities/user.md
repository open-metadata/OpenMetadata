# user

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json
```

User entity that is part of an organization

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                 |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [user.json](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json "open original schema") |

## User entity Type

`object` ([User entity](user.md))

# User entity Properties

| Property                    | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                           |
| :-------------------------- | :-------- | :------- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#id)                   | `string`  | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                               |
| [name](#name)               | `string`  | Required | cannot be null | [User entity](#user-properties-name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/name")                               |
| [displayName](#displayname) | `string`  | Optional | cannot be null | [User entity](#user-properties-displayname "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/displayName")                 |
| [email](#email)             | `string`  | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-email)                           |
| [href](#href)               | `string`  | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-href)                             |
| [timezone](#timezone)       | `string`  | Optional | cannot be null | [User entity](#user-properties-timezone "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/timezone")                       |
| [deactivated](#deactivated) | `boolean` | Optional | cannot be null | [User entity](#user-properties-deactivated "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/deactivated")                 |
| [isBot](#isbot)             | `boolean` | Optional | cannot be null | [User entity](#user-properties-isbot "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/isBot")                             |
| [isAdmin](#isadmin)         | `boolean` | Optional | cannot be null | [User entity](#user-properties-isAdmin "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/isAdmin")                         |
| [profile](#profile)         | `object`  | Optional | cannot be null | [Profile type](../types/profile.md)                                              |
| [teams](#teams)             | `array`   | Optional | cannot be null | [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)   |
| [owns](#owns)               | `array`   | Optional | cannot be null | [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)    |
| [follows](#follows)         | `array`   | Optional | cannot be null | [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist) |

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

## name

Unique name of the user typically the user ID from the identify provider. Example - uid from ldap.

`name`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [User entity](#user-properties-name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/name")

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## displayName

Name used for display purposes. Example 'FirstName LastName'

`displayName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [User entity](#user-properties-displayname "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/displayName")

### displayName Type

`string`

## email

Email address of user or other entities

`email`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-email)

### email Type

`string`

### email Constraints

**maximum length**: the maximum number of characters for this string is: `127`

**minimum length**: the minimum number of characters for this string is: `6`

**pattern**: the string must match the following regular expression: 

```regexp
^\S+@\S+\.\S+$
```

[try pattern](https://regexr.com/?expression=%5E%5CS%2B%40%5CS%2B%5C.%5CS%2B%24 "try regular expression with regexr.com")

**email**: the string must be an email address, according to [RFC 5322, section 3.4.1](https://tools.ietf.org/html/rfc5322 "check the specification")

## href

Link to the resource corresponding to this entity

> Link to the resource

`href`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-href)

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## timezone

Timezone of the user

`timezone`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [User entity](#user-properties-timezone "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/timezone")

### timezone Type

`string`

### timezone Constraints

**unknown format**: the value of this string must follow the format: `timezone`

## deactivated



`deactivated`

*   is optional

*   Type: `boolean`

*   cannot be null

*   defined in: [User entity](#user-properties-deactivated "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/deactivated")

### deactivated Type

`boolean`

## isBot



`isBot`

*   is optional

*   Type: `boolean`

*   cannot be null

*   defined in: [User entity](#user-properties-isbot "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/isBot")

### isBot Type

`boolean`

## isAdmin

When true indicates user is an adiministrator for the sytem with superuser privileges

`isAdmin`

*   is optional

*   Type: `boolean`

*   cannot be null

*   defined in: [User entity](#user-properties-isAdmin "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/isAdmin")

### isAdmin Type

`boolean`

## profile

Type used to capture profile of a user, team, or an organization

`profile`

*   is optional

*   Type: `object` ([Type used to capture profile of a user, team, or an organization](profile.md))

*   cannot be null

*   defined in: [Profile type](../types/profile.md)

### profile Type

`object` ([Type used to capture profile of a user, team, or an organization](profile.md))

## teams

Teams that the user belongs to

`teams`

*   is optional

*   Type: `object[]` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)

### teams Type

`object[]` ([Entity Reference](entityreference.md))

## owns

Entities owned by the user

`owns`

*   is optional

*   Type: `object[]` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)

### owns Type

`object[]` ([Entity Reference](entityreference.md))

## follows

Entities followed by the user

`follows`

*   is optional

*   Type: `object[]` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)

### follows Type

`object[]` ([Entity Reference](entityreference.md))

# User entity Definitions

## Definitions group userName

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/definitions/userName"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |
# user-definitions-username

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/teams/createUser.json#/properties/name
```

Unique name of the user typically the user ID from the identify provider. Example - uid from ldap.

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createUser.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/teams/createUser.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`
# user-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [user.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json "open original schema") |

## definitions Type

unknown
# user-properties-deactivated

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/deactivated
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [user.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json "open original schema") |

## deactivated Type

`boolean`
# user-properties-displayname

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/displayName
```

Name used for display purposes. Example 'FirstName LastName'

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [user.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json "open original schema") |

## displayName Type

`string`
# user-properties-isadmin

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/isAdmin
```

When true indicates user is an adiministrator for the sytem with superuser privileges

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [user.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json "open original schema") |

## isAdmin Type

`boolean`
# user-properties-isbot

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/isBot
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [user.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json "open original schema") |

## isBot Type

`boolean`
# user-properties-name

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/name
```

Unique name of the user typically the user ID from the identify provider. Example - uid from ldap.

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [user.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`
# user-properties-timezone

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json#/properties/timezone
```

Timezone of the user

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [user.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json "open original schema") |

## timezone Type

`string`

## timezone Constraints

**unknown format**: the value of this string must follow the format: `timezone`
