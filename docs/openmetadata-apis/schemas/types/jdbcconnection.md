# Jdbc Connection Type

## jdbcconnection

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json
```

JDBC connection information used for connecting to a database system

> JDBC connection information

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Allowed | none | [jdbcConnection.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json) |

### JDBC connection Type

`object` \([JDBC connection](jdbcconnection.md)\)

## JDBC connection Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [driverClass](jdbcconnection.md#driverclass) | `string` | Required | cannot be null | [JDBC connection](jdbcconnection.md#jdbcconnection-properties-driverclass) |
| [connectionUrl](jdbcconnection.md#connectionurl) | `string` | Required | cannot be null | [JDBC connection](jdbcconnection.md#jdbcconnection-properties-connectionurl) |
| [userName](jdbcconnection.md#username) | `string` | Required | cannot be null | [JDBC connection](jdbcconnection.md#jdbcconnection-properties-username) |
| [password](jdbcconnection.md#password) | `string` | Required | cannot be null | [JDBC connection](jdbcconnection.md#jdbcconnection-properties-password) |

### driverClass

> Type used for JDBC driver class

`driverClass`

* is required
* Type: `string`
* cannot be null
* defined in: [JDBC connection](jdbcconnection.md#jdbcconnection-properties-driverclass)

#### driverClass Type

`string`

### connectionUrl

> Type used for JDBC connection URL

`connectionUrl`

* is required
* Type: `string`
* cannot be null
* defined in: [JDBC connection](jdbcconnection.md#jdbcconnection-properties-connectionurl)

#### connectionUrl Type

`string`

#### connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

### userName

Login user name

`userName`

* is required
* Type: `string`
* cannot be null
* defined in: [JDBC connection](jdbcconnection.md#jdbcconnection-properties-username)

#### userName Type

`string`

### password

Login password

`password`

* is required
* Type: `string`
* cannot be null
* defined in: [JDBC connection](jdbcconnection.md#jdbcconnection-properties-password)

#### password Type

`string`

## JDBC connection Definitions

### Definitions group driverClass

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/driverClass"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group connectionUrl

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/connectionUrl"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group jdbcInfo

Reference this group by using

```javascript
{"$ref":"https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [driverClass](jdbcconnection.md#driverclass-1) | `string` | Required | cannot be null | [JDBC connection](jdbcconnection.md#jdbcconnection-definitions-driverclass) |
| [connectionUrl](jdbcconnection.md#connectionurl-1) | `string` | Required | cannot be null | [JDBC connection](jdbcconnection.md#jdbcconnection-definitions-connectionurl) |

#### driverClass

> Type used for JDBC driver class

`driverClass`

* is required
* Type: `string`
* cannot be null
* defined in: [JDBC connection](jdbcconnection.md#jdbcconnection-definitions-driverclass)

**driverClass Type**

`string`

**driverClass Default Value**

The default value is:

```javascript
"com.amazon.redshift.jdbc42.Driver"
```

#### connectionUrl

> Type used for JDBC connection URL

`connectionUrl`

* is required
* Type: `string`
* cannot be null
* defined in: [JDBC connection](jdbcconnection.md#jdbcconnection-definitions-connectionurl)

**connectionUrl Type**

`string`

**connectionUrl Constraints**

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## jdbcconnection-definitions-connectionurl

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/connectionUrl
```

> Type used for JDBC connection URL

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [jdbcConnection.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json) |

### connectionUrl Type

`string`

### connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## jdbcconnection-definitions-driverclass

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions/jdbcInfo/properties/driverClass
```

> Type used for JDBC driver class

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [jdbcConnection.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json) |

### driverClass Type

`string`

### driverClass Default Value

The default value is:

```javascript
"com.amazon.redshift.jdbc42.Driver"
```

## jdbcconnection-definitions-jdbcinfo

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json#/properties/jdbc
```

> Type for capturing JDBC connector information

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [databaseService.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json) |

### jdbc Type

`object` \([Details](jdbcconnection.md#jdbcconnection-definitions-jdbcinfo)\)

## jdbc Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [driverClass](jdbcconnection.md#driverclass) | `string` | Required | cannot be null | [JDBC connection](jdbcconnection.md#jdbcconnection-definitions-driverclass) |
| [connectionUrl](jdbcconnection.md#connectionurl) | `string` | Required | cannot be null | [JDBC connection](jdbcconnection.md#jdbcconnection-definitions-connectionurl) |

### driverClass

> Type used for JDBC driver class

`driverClass`

* is required
* Type: `string`
* cannot be null
* defined in: [JDBC connection](jdbcconnection.md#jdbcconnection-definitions-driverclass)

#### driverClass Type

`string`

#### driverClass Default Value

The default value is:

```javascript
"com.amazon.redshift.jdbc42.Driver"
```

### connectionUrl

> Type used for JDBC connection URL

`connectionUrl`

* is required
* Type: `string`
* cannot be null
* defined in: [JDBC connection](jdbcconnection.md#jdbcconnection-definitions-connectionurl)

#### connectionUrl Type

`string`

#### connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## jdbcconnection-definitions

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [jdbcConnection.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json) |

### definitions Type

unknown

## jdbcconnection-properties-connectionurl

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/connectionUrl
```

> Type used for JDBC connection URL

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [jdbcConnection.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json) |

### connectionUrl Type

`string`

### connectionUrl Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986)

## jdbcconnection-properties-driverclass

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/driverClass
```

> Type used for JDBC driver class

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [jdbcConnection.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json) |

### driverClass Type

`string`

## jdbcconnection-properties-password

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/password
```

Login password

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [jdbcConnection.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json) |

### password Type

`string`

## jdbcconnection-properties-username

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json#/properties/userName
```

Login user name

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [jdbcConnection.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json) |

### userName Type

`string`

