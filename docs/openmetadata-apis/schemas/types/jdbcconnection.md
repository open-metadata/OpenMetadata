# JDBC connection

This schema defines the type used for JDBC connection information.

**$id: **[https://open-metadata.org/schema/type/jdbcConnection.json](https://open-metadata.org/schema/type/jdbcConnection.json)

Type: `object`

## Properties
 - **driverClass** `required`
   - JDBC driver class.
   - $ref: [#/definitions/driverClass](#driverclass)
 - **connectionUrl** `required`
   - JDBC connection URL.
   - $ref: [#/definitions/connectionUrl](#connectionurl)
 - **userName** `required`
   - Login user name.
   - Type: `string`
 - **password** `required`
   - Login password.
   - Type: `string`

* **driverClass** `required`
  * JDBC driver class.
  * $ref: [#/definitions/driverClass](jdbcconnection.md#driverclass)
* **connectionUrl** `required`
  * JDBC connection URL.
  * $ref: [#/definitions/connectionUrl](jdbcconnection.md#connectionurl)
* **userName** `required`
  * Login user name.
  * Type: `string`
* **password** `required`
  * Login password.
  * Type: `string`

## Type definitions in this schema
### driverClass

 - Type used for JDBC driver class.
 - Type: `string`


### connectionUrl

 - Type used for JDBC connection URL of format `url_scheme://<username>:<password>@<host>:<port>/<db_name>`.
 - Type: `string`


### jdbcInfo

* Type for capturing JDBC connector information.
* Type: `object`
* **Properties**
  * **driverClass** `required`
    * $ref: [#/definitions/driverClass](jdbcconnection.md#driverclass)
  * **connectionUrl** `required`
    * $ref: [#/definitions/connectionUrl](jdbcconnection.md#connectionurl)

_This document was updated on: Thursday, September 16, 2021_
