# team

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json
```

Team entity

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                 |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [team.json](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json "open original schema") |

## Team entity Type

`object` ([Team entity](team.md))

# Team entity Properties

| Property                    | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                         |
| :-------------------------- | :-------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#id)                   | `string`  | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                             |
| [name](#name)               | `string`  | Required | cannot be null | [Team entity](#team-properties-name "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/name")                             |
| [displayName](#displayname) | `string`  | Optional | cannot be null | [Team entity](#team-properties-displayname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/displayName")               |
| [description](#description) | `string`  | Optional | cannot be null | [Team entity](#team-properties-description "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/description")               |
| [href](#href)               | `string`  | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-href)                           |
| [profile](#profile)         | `object`  | Optional | cannot be null | [Profile type](../types/profile.md)                                            |
| [deleted](#deleted)         | `boolean` | Optional | cannot be null | [Team entity](#team-properties-deleted "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/deleted")                       |
| [users](#users)             | `array`   | Optional | cannot be null | [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist) |
| [owns](#owns)               | `array`   | Optional | cannot be null | [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)  |

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

Unique name of the team typically the team ID from the identify provider. Example - group Id from ldap.

`name`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Team entity](#team-properties-name "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/name")

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## displayName

Name used for display purposes. Example 'Data Science team'

`displayName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Team entity](#team-properties-displayname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/displayName")

### displayName Type

`string`

## description

Description of the team

`description`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Team entity](#team-properties-description "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/description")

### description Type

`string`

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

## profile

Type used to capture profile of a user, team, or an organization

`profile`

*   is optional

*   Type: `object` ([Type used to capture profile of a user, team, or an organization](profile.md))

*   cannot be null

*   defined in: [Profile type](../types/profile.md)

### profile Type

`object` ([Type used to capture profile of a user, team, or an organization](profile.md))

## deleted



`deleted`

*   is optional

*   Type: `boolean`

*   cannot be null

*   defined in: [Team entity](#team-properties-deleted "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/deleted")

### deleted Type

`boolean`

## users

Users that are part of the team

`users`

*   is optional

*   Type: `object[]` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)

### users Type

`object[]` ([Entity Reference](entityreference.md))

## owns

Entities owned by the team

`owns`

*   is optional

*   Type: `object[]` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)

### owns Type

`object[]` ([Entity Reference](entityreference.md))
# team-defintions-teamname

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/teams/createTeam.json#/properties/name
```

Unique name of the team typically the team ID from the identify provider. Example - group Id from ldap.

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :----------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createTeam.json*](../../../../out/api/teams/createTeam.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`
# team-defintions

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/defintions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [team.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json "open original schema") |

## defintions Type

unknown
# team-properties-deleted

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/deleted
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [team.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json "open original schema") |

## deleted Type

`boolean`
# team-properties-description

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/description
```

Description of the team

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [team.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json "open original schema") |

## description Type

`string`
# team-properties-displayname

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/displayName
```

Name used for display purposes. Example 'Data Science team'

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [team.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json "open original schema") |

## displayName Type

`string`
# team-properties-name

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json#/properties/name
```

Unique name of the team typically the team ID from the identify provider. Example - group Id from ldap.

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [team.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`
