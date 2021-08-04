# jdbcconnection

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json
```

JDBC connection information used for connecting to a database system

> JDBC connection information

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                             |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [jdbcConnection.json](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json "open original schema") |

## JDBC connection Type

`object` ([JDBC connection](jdbcconnection.md))

# JDBC connection Properties

| Property                        | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                               |
| :------------------------------ | :------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [driverClass](#driverclass)     | `string` | Required | cannot be null | [JDBC connection](#jdbcconnection-properties-driverclass "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/driverClass")     |
| [connectionUrl](#connectionurl) | `string` | Required | cannot be null | [JDBC connection](#jdbcconnection-properties-connectionurl "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/connectionUrl") |
| [userName](#username)           | `string` | Required | cannot be null | [JDBC connection](#jdbcconnection-properties-username "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/userName")           |
| [password](#password)           | `string` | Required | cannot be null | [JDBC connection](#jdbcconnection-properties-password "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/password")           |

## driverClass



> Type used for JDBC driver class

`driverClass`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [JDBC connection](#jdbcconnection-properties-driverclass "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/driverClass")

### driverClass Type

`string`

## connectionUrl



> Type used for JDBC connection URL

`connectionUrl`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [JDBC connection](#jdbcconnection-properties-connectionurl "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/connectionUrl")

### connectionUrl Type

`string`

### connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## userName

Login user name

`userName`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [JDBC connection](#jdbcconnection-properties-username "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/userName")

### userName Type

`string`

## password

Login password

`password`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [JDBC connection](#jdbcconnection-properties-password "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/password")

### password Type

`string`

# JDBC connection Definitions

## Definitions group driverClass

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/driverClass"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group connectionUrl

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/connectionUrl"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group jdbcInfo

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo"}
```

| Property                          | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                         |
| :-------------------------------- | :------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [driverClass](#driverclass-1)     | `string` | Required | cannot be null | [JDBC connection](#jdbcconnection-definitions-driverclass "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/driverClass")     |
| [connectionUrl](#connectionurl-1) | `string` | Required | cannot be null | [JDBC connection](#jdbcconnection-definitions-connectionurl "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/connectionUrl") |

### driverClass



> Type used for JDBC driver class

`driverClass`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [JDBC connection](#jdbcconnection-definitions-driverclass "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/driverClass")

#### driverClass Type

`string`

#### driverClass Default Value

The default value is:

```json
"com.amazon.redshift.jdbc42.Driver"
```

### connectionUrl



> Type used for JDBC connection URL

`connectionUrl`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [JDBC connection](#jdbcconnection-definitions-connectionurl "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/connectionUrl")

#### connectionUrl Type

`string`

#### connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# jdbcconnection-definitions-connectionurl

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/connectionUrl
```



> Type used for JDBC connection URL

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                              |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [jdbcConnection.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json "open original schema") |

## connectionUrl Type

`string`

## connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# jdbcconnection-definitions-driverclass

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/driverClass
```



> Type used for JDBC driver class

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                              |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [jdbcConnection.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json "open original schema") |

## driverClass Type

`string`

## driverClass Default Value

The default value is:

```json
"com.amazon.redshift.jdbc42.Driver"
```
# jdbcconnection-definitions-jdbcinfo

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/services/updateDatabaseService.json#/properties/jdbc
```



> Type for capturing JDBC connector information

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                                                    |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [updateDatabaseService.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/services/updateDatabaseService.json "open original schema") |

## jdbc Type

`object` ([Details](../types/jdbcconnection.md#jdbcconnection-definitions-jdbcinfo))

# jdbc Properties

| Property                        | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                     |
| :------------------------------ | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [driverClass](#driverclass)     | `string` | Required | cannot be null | [JDBC connection](#jdbcconnection-definitions-driverclass "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/driverClass")     |
| [connectionUrl](#connectionurl) | `string` | Required | cannot be null | [JDBC connection](#jdbcconnection-definitions-connectionurl "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/connectionUrl") |

## driverClass



> Type used for JDBC driver class

`driverClass`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [JDBC connection](#jdbcconnection-definitions-driverclass "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/driverClass")

### driverClass Type

`string`

### driverClass Default Value

The default value is:

```json
"com.amazon.redshift.jdbc42.Driver"
```

## connectionUrl



> Type used for JDBC connection URL

`connectionUrl`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [JDBC connection](#jdbcconnection-definitions-connectionurl "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/connectionUrl")

### connectionUrl Type

`string`

### connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# jdbcconnection-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                              |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [jdbcConnection.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json "open original schema") |

## definitions Type

unknown
# jdbcconnection-properties-connectionurl

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/connectionUrl
```



> Type used for JDBC connection URL

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                              |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [jdbcConnection.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json "open original schema") |

## connectionUrl Type

`string`

## connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")
# jdbcconnection-properties-driverclass

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/driverClass
```



> Type used for JDBC driver class

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                              |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [jdbcConnection.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json "open original schema") |

## driverClass Type

`string`
# jdbcconnection-properties-password

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/password
```

Login password

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                              |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [jdbcConnection.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json "open original schema") |

## password Type

`string`
# jdbcconnection-properties-username

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/userName
```

Login user name

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                              |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [jdbcConnection.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json "open original schema") |

## userName Type

`string`
