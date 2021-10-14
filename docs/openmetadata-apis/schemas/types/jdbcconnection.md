# Jdbc Connection

This schema defines the type used for JDBC connection information.

**$id: [https://open-metadata.org/schema/type/jdbcConnection.json](https://open-metadata.org/schema/type/jdbcConnection.json)**

Type: `object`

## Properties


## Type definitions in this schema

### driverClass

* The Type used for the JDBC driver class.
* Type: `string`

### connectionUrl

* The Type used for JDBC connection URL.
* Type: `string`
* String format must be a "uri"

### jdbcInfo

 - Type for capturing JDBC connector information.
 - Type: `object`
 - **Properties**
   - **driverClass** `required`
   - $ref: [#/definitions/driverClass](#driverclass)
 - **connectionUrl** `required`
   - $ref: [#/definitions/connectionUrl](#connectionurl)

_This document was updated on: Monday, October 18, 2021_