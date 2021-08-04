# databaseservice

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json
```

Database service entity that reference services such as MySQL, BigQuery, Redshift, Postgres or Snowflake

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                          |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [databaseService.json](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## Database service entity Type

`object` ([Database service entity](databaseservice.md))

# Database service entity Properties

| Property                                | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                |
| :-------------------------------------- | :------- | :------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#id)                               | `string` | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                          |
| [name](#name)                           | `string` | Required | cannot be null | [Database service entity](#databaseservice-Properties-Name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/name")               |
| [serviceType](#servicetype)             | `string` | Required | cannot be null | [Database service entity](#databaseservice-properties-servicetype "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/serviceType") |
| [description](#description)             | `string` | Optional | cannot be null | [Database service entity](#databaseservice-properties-description "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/description") |
| [href](#href)                           | `string` | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-href)                        |
| [jdbc](#jdbc)                           | `object` | Required | cannot be null | [Jdbc Connection type](../types/jdbcconnection.md#jdbcconnection-definitions-jdbcinfo)           |
| [ingestionSchedule](#ingestionschedule) | `object` | Optional | cannot be null | [Schedule type](../types/schedule.md)                                           |

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

Name that identifies the this entity instance uniquely. Same as id if when name is not unique

`name`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Database service entity](#databaseservice-Properties-Name "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/name")

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

## serviceType

Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...

`serviceType`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Database service entity](#databaseservice-properties-servicetype "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/serviceType")

### serviceType Type

`string`

### serviceType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value         | Explanation |
| :------------ | :---------- |
| `"BigQuery"`  |             |
| `"MySQL"`     |             |
| `"Redshift"`  |             |
| `"Snowflake"` |             |
| `"Postgres"`  |             |
| `"MSSQL"`     |             |
| `"Hive"`      |             |

## description

Description of database service instance.

`description`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Database service entity](#databaseservice-properties-description "https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/description")

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

## jdbc



> Type for capturing JDBC connector information

`jdbc`

*   is required

*   Type: `object` ([Details](../types/jdbcconnection.md#jdbcconnection-definitions-jdbcinfo))

*   cannot be null

*   defined in: [Jdbc Connection type](../types/jdbcconnection.md#jdbcconnection-definitions-jdbcinfo)

### jdbc Type

`object` ([Details](../types/jdbcconnection.md#jdbcconnection-definitions-jdbcinfo))

## ingestionSchedule

Type used for schedule with start time and repeat frequency

`ingestionSchedule`

*   is optional

*   Type: `object` ([Type used for schedule with start time and repeat frequency](schedule.md))

*   cannot be null

*   defined in: [Schedule type](../types/schedule.md)

### ingestionSchedule Type

`object` ([Type used for schedule with start time and repeat frequency](schedule.md))

# Database service entity Definitions

## Definitions group databaseServiceType

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions/databaseServiceType"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |
# databaseservice-definitions-databaseservicetype-javaenums-0

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions/databaseServiceType/javaEnums/0
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## 0 Type

unknown
# databaseservice-definitions-databaseservicetype-javaenums-1

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions/databaseServiceType/javaEnums/1
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## 1 Type

unknown
# databaseservice-definitions-databaseservicetype-javaenums-2

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions/databaseServiceType/javaEnums/2
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## 2 Type

unknown
# databaseservice-definitions-databaseservicetype-javaenums-3

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions/databaseServiceType/javaEnums/3
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## 3 Type

unknown
# databaseservice-definitions-databaseservicetype-javaenums-4

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions/databaseServiceType/javaEnums/4
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## 4 Type

unknown
# databaseservice-definitions-databaseservicetype-javaenums-5

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions/databaseServiceType/javaEnums/5
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## 5 Type

unknown
# databaseservice-definitions-databaseservicetype-javaenums-6

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions/databaseServiceType/javaEnums/6
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## 6 Type

unknown
# databaseservice-definitions-databaseservicetype

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/api/services/createDatabaseService.json#/properties/serviceType
```

Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                                    |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createDatabaseService.json*](../../../../out/api/services/createDatabaseService.json "open original schema") |

## serviceType Type

`string`

## serviceType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value         | Explanation |
| :------------ | :---------- |
| `"BigQuery"`  |             |
| `"MySQL"`     |             |
| `"Redshift"`  |             |
| `"Snowflake"` |             |
| `"Postgres"`  |             |
| `"MSSQL"`     |             |
| `"Hive"`      |             |
# databaseservice-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## definitions Type

unknown
# databaseservice-properties-description

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/description
```

Description of database service instance.

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## description Type

`string`
# databaseservice-properties-name

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/name
```

Name that identifies the this entity instance uniquely. Same as id if when name is not unique

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`
# databaseservice-properties-servicetype

```txt
https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/serviceType
```

Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                           |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [databaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/schema-scripts/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json "open original schema") |

## serviceType Type

`string`

## serviceType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value         | Explanation |
| :------------ | :---------- |
| `"BigQuery"`  |             |
| `"MySQL"`     |             |
| `"Redshift"`  |             |
| `"Snowflake"` |             |
| `"Postgres"`  |             |
| `"MSSQL"`     |             |
| `"Hive"`      |             |
