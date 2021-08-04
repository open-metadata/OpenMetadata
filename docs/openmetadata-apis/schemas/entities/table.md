# table

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json
```

Schema corresponding to a table that belongs to a database

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                  |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [table.json](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## Table entity Type

`object` ([Table entity](table.md))

# Table entity Properties

| Property                                  | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                    |
| :---------------------------------------- | :------- | :------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#id)                                 | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid)                                 |
| [name](#name)                             | `string` | Required | cannot be null | [Table entity](#table-properties-name "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/name")                                |
| [description](#description)               | `string` | Optional | cannot be null | [Table entity](#table-properties-description "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/description")                  |
| [href](#href)                             | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href)                               |
| [tableType](#tabletype)                   | `string` | Optional | cannot be null | [Table entity](#table-properties-tabletype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tableType")                      |
| [fullyQualifiedName](#fullyqualifiedname) | `string` | Optional | cannot be null | [Table entity](#table-properties-fullyqualifiedname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/fullyQualifiedName")    |
| [columns](#columns)                       | `array`  | Required | cannot be null | [Table entity](#table-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/columns")                          |
| [tableConstraints](#tableconstraints)     | `array`  | Optional | cannot be null | [Table entity](#table-properties-tableconstraints "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tableConstraints")        |
| [usageSummary](#usagesummary)             | `object` | Optional | cannot be null | [Usage Details type](../types/usagedetails.md)                                 |
| [owner](#owner)                           | `object` | Optional | cannot be null | [Entity Reference type](../types/entityreference.md)                                  |
| [followers](#followers)                   | `array`  | Optional | cannot be null | [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist) |
| [database](#database)                     | `object` | Optional | cannot be null | [Table entity](entityreference.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/database")                               |
| [tags](#tags)                             | `array`  | Optional | cannot be null | [Table entity](#table-properties-tags "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tags")                                |
| [joins](#joins)                           | `object` | Optional | cannot be null | [Table entity](#table-definitions-tablejoins "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/joins")                        |
| [sampleData](#sampledata)                 | `object` | Optional | cannot be null | [Table entity](#table-definitions-tabledata "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/sampleData")                    |

## id

Unique id used to identify an entity

`id`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-uuid)

### id Type

`string`

### id Constraints

**UUID**: the string must be a UUID, according to [RFC 4122](https://tools.ietf.org/html/rfc4122 "check the specification")

## name

Local name (not fully qualified name) of the table

`name`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-properties-name "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/name")

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")

## description

Description of the table

`description`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-properties-description "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/description")

### description Type

`string`

## href

Link to this table resource

> Link to the resource

`href`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-href)

### href Type

`string`

### href Constraints

**URI**: the string must be a URI, according to [RFC 3986](https://tools.ietf.org/html/rfc3986 "check the specification")

## tableType

Type for capturing a column in a table

`tableType`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-properties-tabletype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tableType")

### tableType Type

`string`

### tableType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value                | Explanation |
| :------------------- | :---------- |
| `"Regular"`          |             |
| `"External"`         |             |
| `"View"`             |             |
| `"SecureView"`       |             |
| `"MaterializedView"` |             |

## fullyQualifiedName

Fully qualified name of the table in the form serviceName.databaseName.tableName

`fullyQualifiedName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-properties-fullyqualifiedname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/fullyQualifiedName")

### fullyQualifiedName Type

`string`

## columns

Columns in the table

`columns`

*   is required

*   Type: `object[]` ([Details](../types/basic.md#table-definitions-column))

*   cannot be null

*   defined in: [Table entity](#table-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/columns")

### columns Type

`object[]` ([Details](../types/basic.md#table-definitions-column))

## tableConstraints

Table constraints

`tableConstraints`

*   is optional

*   Type: `object[]` ([Details](#table-definitions-tableconstraint))

*   cannot be null

*   defined in: [Table entity](#table-properties-tableconstraints "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tableConstraints")

### tableConstraints Type

`object[]` ([Details](#table-definitions-tableconstraint))

## usageSummary

Type used to return usage details of an entity

`usageSummary`

*   is optional

*   Type: `object` ([Type used to return usage details of an entity](usagedetails.md))

*   cannot be null

*   defined in: [Usage Details type](../types/usagedetails.md)

### usageSummary Type

`object` ([Type used to return usage details of an entity](usagedetails.md))

## owner

Entity reference that includes entity ID and entity type

`owner`

*   is optional

*   Type: `object` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md)

### owner Type

`object` ([Entity Reference](entityreference.md))

## followers

Followers of this table

`followers`

*   is optional

*   Type: `object[]` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)

### followers Type

`object[]` ([Entity Reference](entityreference.md))

## database

Entity reference that includes entity ID and entity type

`database`

*   is optional

*   Type: `object` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Table entity](entityreference.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/database")

### database Type

`object` ([Entity Reference](entityreference.md))

## tags

Tags for this table

`tags`

*   is optional

*   Type: `object[]` ([Tag Label](taglabel.md))

*   cannot be null

*   defined in: [Table entity](#table-properties-tags "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tags")

### tags Type

`object[]` ([Tag Label](taglabel.md))

## joins

Details of other tables this table is frequently joined with

`joins`

*   is optional

*   Type: `object` ([Details](#table-definitions-tablejoins))

*   cannot be null

*   defined in: [Table entity](#table-definitions-tablejoins "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/joins")

### joins Type

`object` ([Details](#table-definitions-tablejoins))

## sampleData

Information on other tables that this table column is frequently joined with

`sampleData`

*   is optional

*   Type: `object` ([Details](#table-definitions-tabledata))

*   cannot be null

*   defined in: [Table entity](#table-definitions-tabledata "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/sampleData")

### sampleData Type

`object` ([Details](#table-definitions-tabledata))

# Table entity Definitions

## Definitions group tableType

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group columnDataType

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnDataType"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group columnConstraint

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnConstraint"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group tableConstraint

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint"}
```

| Property                          | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                 |
| :-------------------------------- | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [constraintType](#constrainttype) | `string` | Optional | cannot be null | [Table entity](#table-definitions-tableconstraint-properties-constrainttype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/constraintType") |
| [columns](#columns-1)             | `array`  | Optional | cannot be null | [Table entity](#table-definitions-tableconstraint-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/columns")               |

### constraintType



`constraintType`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tableconstraint-properties-constrainttype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/constraintType")

#### constraintType Type

`string`

#### constraintType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value           | Explanation |
| :-------------- | :---------- |
| `"UNIQUE"`      |             |
| `"PRIMARY_KEY"` |             |
| `"FOREIGN_KEY"` |             |

### columns

List of column names corresponding to the constraint

`columns`

*   is optional

*   Type: `string[]`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tableconstraint-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/columns")

#### columns Type

`string[]`

## Definitions group columnName

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnName"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group tableName

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableName"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group fullyQualifiedColumnName

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/fullyQualifiedColumnName"}
```

| Property | Type | Required | Nullable | Defined by |
| :------- | :--- | :------- | :------- | :--------- |

## Definitions group column

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column"}
```

| Property                                    | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                                       |
| :------------------------------------------ | :-------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [name](#name-1)                             | `string`  | Required | cannot be null | [Table entity](#table-definitions-columnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/name")                             |
| [columnDataType](#columndatatype)           | `string`  | Required | cannot be null | [Table entity](#table-Definitions-Columndatatype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnDataType")         |
| [description](#description-1)               | `string`  | Optional | cannot be null | [Table entity](#table-Definitions-Column-Properties-Description "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/description")               |
| [fullyQualifiedName](#fullyqualifiedname-1) | `string`  | Optional | cannot be null | [Table entity](#table-definitions-fullyqualifiedcolumnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/fullyQualifiedName") |
| [tags](#tags-1)                             | `array`   | Optional | cannot be null | [Table entity](#table-Definitions-Column-Properties-Tags "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/tags")                             |
| [columnConstraint](#columnconstraint)       | `string`  | Optional | cannot be null | [Table entity](#table-Definitions-Columnconstraint "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnConstraint")     |
| [ordinalPosition](#ordinalposition)         | `integer` | Optional | cannot be null | [Table entity](#table-Definitions-Column-Properties-Ordinalposition "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/ordinalPosition")       |

### name

Local name (not fully qualified name) of the column

`name`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-columnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/name")

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")

### columnDataType

Type for capturing a column in a table

`columnDataType`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-Definitions-Columndatatype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnDataType")

#### columnDataType Type

`string`

#### columnDataType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value          | Explanation |
| :------------- | :---------- |
| `"NUMBER"`     |             |
| `"TINYINT"`    |             |
| `"SMALLINT"`   |             |
| `"INT"`        |             |
| `"BIGINT"`     |             |
| `"FLOAT"`      |             |
| `"DOUBLE"`     |             |
| `"DECIMAL"`    |             |
| `"NUMERIC"`    |             |
| `"TIMESTAMP"`  |             |
| `"TIME"`       |             |
| `"DATE"`       |             |
| `"DATETIME"`   |             |
| `"INTERVAL"`   |             |
| `"STRING"`     |             |
| `"MEDIUMTEXT"` |             |
| `"TEXT"`       |             |
| `"CHAR"`       |             |
| `"VARCHAR"`    |             |
| `"BOOLEAN"`    |             |
| `"BINARY"`     |             |
| `"VARBINARY"`  |             |
| `"ARRAY"`      |             |
| `"BLOB"`       |             |
| `"LONGBLOB"`   |             |
| `"MEDIUMBLOB"` |             |
| `"MAP"`        |             |
| `"STRUCT"`     |             |
| `"UNION"`      |             |
| `"SET"`        |             |
| `"GEOGRAPHY"`  |             |
| `"ENUM"`       |             |
| `"JSON"`       |             |

### description

Description of the column

`description`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-Definitions-Column-Properties-Description "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/description")

#### description Type

`string`

### fullyQualifiedName

Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName

`fullyQualifiedName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-fullyqualifiedcolumnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/fullyQualifiedName")

#### fullyQualifiedName Type

`string`

#### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `256`

**minimum length**: the minimum number of characters for this string is: `1`

### tags

Tags associated with the column

`tags`

*   is optional

*   Type: `object[]` ([Tag Label](taglabel.md))

*   cannot be null

*   defined in: [Table entity](#table-Definitions-Column-Properties-Tags "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/tags")

#### tags Type

`object[]` ([Tag Label](taglabel.md))

### columnConstraint

Column constraint

`columnConstraint`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-Definitions-Columnconstraint "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnConstraint")

#### columnConstraint Type

`string`

#### columnConstraint Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value           | Explanation |
| :-------------- | :---------- |
| `"NULL"`        |             |
| `"NOT_NULL"`    |             |
| `"UNIQUE"`      |             |
| `"PRIMARY_KEY"` |             |

#### columnConstraint Default Value

The default value is:

```json
"NULL"
```

### ordinalPosition

Ordinal position of the column

`ordinalPosition`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: [Table entity](#table-Definitions-Column-Properties-Ordinalposition "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/ordinalPosition")

#### ordinalPosition Type

`integer`

## Definitions group columnJoins

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins"}
```

| Property                  | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                 |
| :------------------------ | :------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [columnName](#columnname) | `string` | Optional | cannot be null | [Table entity](#table-definitions-columnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/columnName") |
| [joinedWith](#joinedwith) | `array`  | Optional | cannot be null | [Table entity](#table-definitions-columnjoins-properties-joinedwith "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith") |

### columnName

Local name (not fully qualified name) of the column

`columnName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-columnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/columnName")

#### columnName Type

`string`

#### columnName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")

### joinedWith

Fully qualified names of the columns that this column is joined with

`joinedWith`

*   is optional

*   Type: `object[]` ([Details](#table-definitions-columnjoins-properties-joinedwith-items))

*   cannot be null

*   defined in: [Table entity](#table-definitions-columnjoins-properties-joinedwith "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith")

#### joinedWith Type

`object[]` ([Details](#table-definitions-columnjoins-properties-joinedwith-items))

## Definitions group tableJoins

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins"}
```

| Property                    | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                                 |
| :-------------------------- | :-------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [startDate](#startdate)     | `string`  | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-date)                                |
| [dayCount](#daycount)       | `integer` | Optional | cannot be null | [Table entity](#table-definitions-tablejoins-properties-daycount "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/dayCount")       |
| [columnJoins](#columnjoins) | `array`   | Optional | cannot be null | [Table entity](#table-definitions-tablejoins-properties-columnjoins "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/columnJoins") |

### startDate

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

`startDate`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-date)

#### startDate Type

`string`

#### startDate Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")

### dayCount



`dayCount`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tablejoins-properties-daycount "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/dayCount")

#### dayCount Type

`integer`

#### dayCount Default Value

The default value is:

```json
1
```

### columnJoins



`columnJoins`

*   is optional

*   Type: `object[]` ([Details](#table-definitions-columnjoins))

*   cannot be null

*   defined in: [Table entity](#table-definitions-tablejoins-properties-columnjoins "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/columnJoins")

#### columnJoins Type

`object[]` ([Details](#table-definitions-columnjoins))

## Definitions group tableData

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData"}
```

| Property              | Type    | Required | Nullable       | Defined by                                                                                                                                                                                                                                       |
| :-------------------- | :------ | :------- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [columns](#columns-2) | `array` | Optional | cannot be null | [Table entity](#table-definitions-tabledata-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/columns") |
| [rows](#rows)         | `array` | Optional | cannot be null | [Table entity](#table-definitions-tabledata-properties-rows "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/rows")       |

### columns

List of local column names (not fully qualified column names) of the table

`columns`

*   is optional

*   Type: `string[]`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tabledata-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/columns")

#### columns Type

`string[]`

### rows

Data for a multiple rows of the table

`rows`

*   is optional

*   Type: `array[]`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tabledata-properties-rows "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/rows")

#### rows Type

`array[]`
# table-definitions-column-properties-description

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/description
```

Description of the column

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## description Type

`string`
# table-definitions-column-properties-ordinalposition

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/ordinalPosition
```

Ordinal position of the column

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## ordinalPosition Type

`integer`
# table-definitions-column-properties-tags

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/tags
```

Tags associated with the column

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## tags Type

`object[]` ([Tag Label](taglabel.md))
# table-definitions-column

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/columns/items
```

Type for capturing a column in a table

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                            |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [createTable.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json "open original schema") |

## items Type

`object` ([Details](../types/basic.md#table-definitions-column))

# items Properties

| Property                                  | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                                 |
| :---------------------------------------- | :-------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [name](#name)                             | `string`  | Required | cannot be null | [Table entity](#table-definitions-columnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/name")                                   |
| [columnDataType](#columndatatype)         | `string`  | Required | cannot be null | [Table entity](#table-definitions-columndatatype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnDataType")                     |
| [description](#description)               | `string`  | Optional | cannot be null | [Table entity](#table-Definitions-Column-Properties-Description "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/description")         |
| [fullyQualifiedName](#fullyqualifiedname) | `string`  | Optional | cannot be null | [Table entity](#table-definitions-fullyqualifiedcolumnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/fullyQualifiedName")       |
| [tags](#tags)                             | `array`   | Optional | cannot be null | [Table entity](#table-Definitions-Column-Properties-Tags "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/tags")                       |
| [columnConstraint](#columnconstraint)     | `string`  | Optional | cannot be null | [Table entity](#table-definitions-columnconstraint "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnConstraint")                 |
| [ordinalPosition](#ordinalposition)       | `integer` | Optional | cannot be null | [Table entity](#table-Definitions-Column-Properties-Ordinalposition "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/ordinalPosition") |

## name

Local name (not fully qualified name) of the column

`name`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-columnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/name")

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")

## columnDataType

Type for capturing a column in a table

`columnDataType`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-columndatatype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnDataType")

### columnDataType Type

`string`

### columnDataType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value          | Explanation |
| :------------- | :---------- |
| `"NUMBER"`     |             |
| `"TINYINT"`    |             |
| `"SMALLINT"`   |             |
| `"INT"`        |             |
| `"BIGINT"`     |             |
| `"FLOAT"`      |             |
| `"DOUBLE"`     |             |
| `"DECIMAL"`    |             |
| `"NUMERIC"`    |             |
| `"TIMESTAMP"`  |             |
| `"TIME"`       |             |
| `"DATE"`       |             |
| `"DATETIME"`   |             |
| `"INTERVAL"`   |             |
| `"STRING"`     |             |
| `"MEDIUMTEXT"` |             |
| `"TEXT"`       |             |
| `"CHAR"`       |             |
| `"VARCHAR"`    |             |
| `"BOOLEAN"`    |             |
| `"BINARY"`     |             |
| `"VARBINARY"`  |             |
| `"ARRAY"`      |             |
| `"BLOB"`       |             |
| `"LONGBLOB"`   |             |
| `"MEDIUMBLOB"` |             |
| `"MAP"`        |             |
| `"STRUCT"`     |             |
| `"UNION"`      |             |
| `"SET"`        |             |
| `"GEOGRAPHY"`  |             |
| `"ENUM"`       |             |
| `"JSON"`       |             |

## description

Description of the column

`description`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-Definitions-Column-Properties-Description "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/description")

### description Type

`string`

## fullyQualifiedName

Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName

`fullyQualifiedName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-fullyqualifiedcolumnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/fullyQualifiedName")

### fullyQualifiedName Type

`string`

### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `256`

**minimum length**: the minimum number of characters for this string is: `1`

## tags

Tags associated with the column

`tags`

*   is optional

*   Type: `object[]` ([Tag Label](taglabel.md))

*   cannot be null

*   defined in: [Table entity](#table-Definitions-Column-Properties-Tags "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/tags")

### tags Type

`object[]` ([Tag Label](taglabel.md))

## columnConstraint

Column constraint

`columnConstraint`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-columnconstraint "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnConstraint")

### columnConstraint Type

`string`

### columnConstraint Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value           | Explanation |
| :-------------- | :---------- |
| `"NULL"`        |             |
| `"NOT_NULL"`    |             |
| `"UNIQUE"`      |             |
| `"PRIMARY_KEY"` |             |

### columnConstraint Default Value

The default value is:

```json
"NULL"
```

## ordinalPosition

Ordinal position of the column

`ordinalPosition`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: [Table entity](#table-Definitions-Column-Properties-Ordinalposition "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/ordinalPosition")

### ordinalPosition Type

`integer`
# table-definitions-columnconstraint

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnConstraint
```

Column constraint

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## columnConstraint Type

`string`

## columnConstraint Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value           | Explanation |
| :-------------- | :---------- |
| `"NULL"`        |             |
| `"NOT_NULL"`    |             |
| `"UNIQUE"`      |             |
| `"PRIMARY_KEY"` |             |

## columnConstraint Default Value

The default value is:

```json
"NULL"
```
# table-definitions-columndatatype

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnDataType
```

Type for capturing a column in a table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## columnDataType Type

`string`

## columnDataType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value          | Explanation |
| :------------- | :---------- |
| `"NUMBER"`     |             |
| `"TINYINT"`    |             |
| `"SMALLINT"`   |             |
| `"INT"`        |             |
| `"BIGINT"`     |             |
| `"FLOAT"`      |             |
| `"DOUBLE"`     |             |
| `"DECIMAL"`    |             |
| `"NUMERIC"`    |             |
| `"TIMESTAMP"`  |             |
| `"TIME"`       |             |
| `"DATE"`       |             |
| `"DATETIME"`   |             |
| `"INTERVAL"`   |             |
| `"STRING"`     |             |
| `"MEDIUMTEXT"` |             |
| `"TEXT"`       |             |
| `"CHAR"`       |             |
| `"VARCHAR"`    |             |
| `"BOOLEAN"`    |             |
| `"BINARY"`     |             |
| `"VARBINARY"`  |             |
| `"ARRAY"`      |             |
| `"BLOB"`       |             |
| `"LONGBLOB"`   |             |
| `"MEDIUMBLOB"` |             |
| `"MAP"`        |             |
| `"STRUCT"`     |             |
| `"UNION"`      |             |
| `"SET"`        |             |
| `"GEOGRAPHY"`  |             |
| `"ENUM"`       |             |
| `"JSON"`       |             |
# table-definitions-columnjoins-properties-joinedwith-items-properties-joincount

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith/items/properties/joinCount
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## joinCount Type

`integer`
# table-definitions-columnjoins-properties-joinedwith-items

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith/items
```



| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## items Type

`object` ([Details](#table-definitions-columnjoins-properties-joinedwith-items))

# items Properties

| Property                                  | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                                                       |
| :---------------------------------------- | :-------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [fullyQualifiedName](#fullyqualifiedname) | `string`  | Optional | cannot be null | [Table entity](#table-definitions-fullyqualifiedcolumnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith/items/properties/fullyQualifiedName")                            |
| [joinCount](#joincount)                   | `integer` | Optional | cannot be null | [Table entity](#table-definitions-columnjoins-properties-joinedwith-items-properties-joincount "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith/items/properties/joinCount") |

## fullyQualifiedName

Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName

`fullyQualifiedName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-fullyqualifiedcolumnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith/items/properties/fullyQualifiedName")

### fullyQualifiedName Type

`string`

### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `256`

**minimum length**: the minimum number of characters for this string is: `1`

## joinCount



`joinCount`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: [Table entity](#table-definitions-columnjoins-properties-joinedwith-items-properties-joincount "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith/items/properties/joinCount")

### joinCount Type

`integer`
# table-definitions-columnjoins-properties-joinedwith

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith
```

Fully qualified names of the columns that this column is joined with

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## joinedWith Type

`object[]` ([Details](#table-definitions-columnjoins-properties-joinedwith-items))
# table-definitions-columnjoins

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/columnJoins/items
```

Information on other tables that this table column is frequently joined with

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Forbidden             | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## items Type

`object` ([Details](#table-definitions-columnjoins))

# items Properties

| Property                  | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                 |
| :------------------------ | :------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [columnName](#columnname) | `string` | Optional | cannot be null | [Table entity](#table-definitions-columnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/columnName")                        |
| [joinedWith](#joinedwith) | `array`  | Optional | cannot be null | [Table entity](#table-definitions-columnjoins-properties-joinedwith "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith") |

## columnName

Local name (not fully qualified name) of the column

`columnName`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-columnname "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/columnName")

### columnName Type

`string`

### columnName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")

## joinedWith

Fully qualified names of the columns that this column is joined with

`joinedWith`

*   is optional

*   Type: `object[]` ([Details](#table-definitions-columnjoins-properties-joinedwith-items))

*   cannot be null

*   defined in: [Table entity](#table-definitions-columnjoins-properties-joinedwith "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith")

### joinedWith Type

`object[]` ([Details](#table-definitions-columnjoins-properties-joinedwith-items))
# table-definitions-columnname

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/name
```

Local name (not fully qualified name) of the column

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")
# table-definitions-fullyqualifiedcolumnname

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/fullyQualifiedName
```

Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## fullyQualifiedName Type

`string`

## fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `256`

**minimum length**: the minimum number of characters for this string is: `1`
# table-definitions-tableconstraint-properties-columns-items

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/columns/items
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## items Type

`string`
# table-definitions-tableconstraint-properties-columns

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/columns
```

List of column names corresponding to the constraint

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## columns Type

`string[]`
# table-definitions-tableconstraint-properties-constrainttype

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/constraintType
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## constraintType Type

`string`

## constraintType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value           | Explanation |
| :-------------- | :---------- |
| `"UNIQUE"`      |             |
| `"PRIMARY_KEY"` |             |
| `"FOREIGN_KEY"` |             |
# table-definitions-tableconstraint

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/tableConstraints/items
```

Table constraint

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                            |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [createTable.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json "open original schema") |

## items Type

`object` ([Details](#table-definitions-tableconstraint))

# items Properties

| Property                          | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                 |
| :-------------------------------- | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [constraintType](#constrainttype) | `string` | Optional | cannot be null | [Table entity](#table-definitions-tableconstraint-properties-constrainttype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/constraintType") |
| [columns](#columns)               | `array`  | Optional | cannot be null | [Table entity](#table-definitions-tableconstraint-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/columns")               |

## constraintType



`constraintType`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tableconstraint-properties-constrainttype "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/constraintType")

### constraintType Type

`string`

### constraintType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value           | Explanation |
| :-------------- | :---------- |
| `"UNIQUE"`      |             |
| `"PRIMARY_KEY"` |             |
| `"FOREIGN_KEY"` |             |

## columns

List of column names corresponding to the constraint

`columns`

*   is optional

*   Type: `string[]`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tableconstraint-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/columns")

### columns Type

`string[]`
# table-definitions-tabledata-properties-columns

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/columns
```

List of local column names (not fully qualified column names) of the table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## columns Type

`string[]`
# table-definitions-tabledata-properties-rows-items

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/rows/items
```

Data for a single row of the table with in the same order as columns fields

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## items Type

`array`
# table-definitions-tabledata-properties-rows

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/rows
```

Data for a multiple rows of the table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## rows Type

`array[]`
# table-definitions-tabledata

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/sampleData
```

Information on other tables that this table column is frequently joined with

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Forbidden             | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## sampleData Type

`object` ([Details](#table-definitions-tabledata))

# sampleData Properties

| Property            | Type    | Required | Nullable       | Defined by                                                                                                                                                                                                                                       |
| :------------------ | :------ | :------- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [columns](#columns) | `array` | Optional | cannot be null | [Table entity](#table-definitions-tabledata-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/columns") |
| [rows](#rows)       | `array` | Optional | cannot be null | [Table entity](#table-definitions-tabledata-properties-rows "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/rows")       |

## columns

List of local column names (not fully qualified column names) of the table

`columns`

*   is optional

*   Type: `string[]`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tabledata-properties-columns "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/columns")

### columns Type

`string[]`

## rows

Data for a multiple rows of the table

`rows`

*   is optional

*   Type: `array[]`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tabledata-properties-rows "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/rows")

### rows Type

`array[]`
# table-definitions-tablejoins-properties-columnjoins

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/columnJoins
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## columnJoins Type

`object[]` ([Details](#table-definitions-columnjoins))
# table-definitions-tablejoins-properties-daycount

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/dayCount
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## dayCount Type

`integer`

## dayCount Default Value

The default value is:

```json
1
```
# table-definitions-tablejoins

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/joins
```

Details of other tables this table is frequently joined with

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Forbidden             | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## joins Type

`object` ([Details](#table-definitions-tablejoins))

# joins Properties

| Property                    | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                                 |
| :-------------------------- | :-------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [startDate](#startdate)     | `string`  | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-date)                                |
| [dayCount](#daycount)       | `integer` | Optional | cannot be null | [Table entity](#table-definitions-tablejoins-properties-daycount "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/dayCount")       |
| [columnJoins](#columnjoins) | `array`   | Optional | cannot be null | [Table entity](#table-definitions-tablejoins-properties-columnjoins "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/columnJoins") |

## startDate

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

`startDate`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-date)

### startDate Type

`string`

### startDate Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")

## dayCount



`dayCount`

*   is optional

*   Type: `integer`

*   cannot be null

*   defined in: [Table entity](#table-definitions-tablejoins-properties-daycount "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/dayCount")

### dayCount Type

`integer`

### dayCount Default Value

The default value is:

```json
1
```

## columnJoins



`columnJoins`

*   is optional

*   Type: `object[]` ([Details](#table-definitions-columnjoins))

*   cannot be null

*   defined in: [Table entity](#table-definitions-tablejoins-properties-columnjoins "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/columnJoins")

### columnJoins Type

`object[]` ([Details](#table-definitions-columnjoins))
# table-definitions-tablename

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/name
```

Local name (not fully qualified name) of the table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                            |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createTable.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")
# table-definitions-tabletype-javaenums-0

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/0
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## 0 Type

unknown
# table-definitions-tabletype-javaenums-1

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/1
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## 1 Type

unknown
# table-definitions-tabletype-javaenums-2

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/2
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## 2 Type

unknown
# table-definitions-tabletype-javaenums-3

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/3
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## 3 Type

unknown
# table-definitions-tabletype-javaenums-4

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/4
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## 4 Type

unknown
# table-definitions-tabletype

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/tableType
```

Type for capturing a column in a table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                            |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------------ |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [createTable.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json "open original schema") |

## tableType Type

`string`

## tableType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value                | Explanation |
| :------------------- | :---------- |
| `"Regular"`          |             |
| `"External"`         |             |
| `"View"`             |             |
| `"SecureView"`       |             |
| `"MaterializedView"` |             |
# table-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## definitions Type

unknown
# table-properties-columns

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/columns
```

Columns in the table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## columns Type

`object[]` ([Details](../types/basic.md#table-definitions-column))
# table-properties-description

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/description
```

Description of the table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## description Type

`string`
# table-properties-fullyqualifiedname

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/fullyQualifiedName
```

Fully qualified name of the table in the form serviceName.databaseName.tableName

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## fullyQualifiedName Type

`string`
# table-properties-name

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/name
```

Local name (not fully qualified name) of the table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## name Type

`string`

## name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression: 

```regexp
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D\*%24 "try regular expression with regexr.com")
# table-properties-tableconstraints

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tableConstraints
```

Table constraints

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## tableConstraints Type

`object[]` ([Details](#table-definitions-tableconstraint))
# table-properties-tabletype

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tableType
```

Type for capturing a column in a table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## tableType Type

`string`

## tableType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value                | Explanation |
| :------------------- | :---------- |
| `"Regular"`          |             |
| `"External"`         |             |
| `"View"`             |             |
| `"SecureView"`       |             |
| `"MaterializedView"` |             |
# table-properties-tags

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tags
```

Tags for this table

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                   |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [table.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json "open original schema") |

## tags Type

`object[]` ([Tag Label](taglabel.md))
