# Table Entity

## table

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json
```

Schema corresponding to a table that belongs to a database

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | Yes | Unknown status | No | Forbidden | Allowed | none | [table.json](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### Table entity Type

`object` \([Table entity](table.md)\)

## Table entity Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [id](table.md#id) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-uuid) |
| [name](table.md#name) | `string` | Required | cannot be null | [Table entity](table.md#table-properties-name) |
| [description](table.md#description) | `string` | Optional | cannot be null | [Table entity](table.md#table-properties-description) |
| [href](table.md#href) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-href) |
| [tableType](table.md#tabletype) | `string` | Optional | cannot be null | [Table entity](table.md#table-properties-tabletype) |
| [fullyQualifiedName](table.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Table entity](table.md#table-properties-fullyqualifiedname) |
| [columns](table.md#columns) | `array` | Required | cannot be null | [Table entity](table.md#table-properties-columns) |
| [tableConstraints](table.md#tableconstraints) | `array` | Optional | cannot be null | [Table entity](table.md#table-properties-tableconstraints) |
| [usageSummary](table.md#usagesummary) | `object` | Optional | cannot be null | [Usage Details type](../types/usagedetails.md) |
| [owner](table.md#owner) | `object` | Optional | cannot be null | [Entity Reference type](../types/entityreference.md) |
| [followers](table.md#followers) | `array` | Optional | cannot be null | [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist) |
| [database](table.md#database) | `object` | Optional | cannot be null | [Table entity](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/entityreference.md) |
| [tags](table.md#tags) | `array` | Optional | cannot be null | [Table entity](table.md#table-properties-tags) |
| [joins](table.md#joins) | `object` | Optional | cannot be null | [Table entity](table.md#table-definitions-tablejoins) |
| [sampleData](table.md#sampledata) | `object` | Optional | cannot be null | [Table entity](table.md#table-definitions-tabledata) |

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

Local name \(not fully qualified name\) of the table

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-properties-name)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

### description

Description of the table

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-properties-description)

#### description Type

`string`

### href

Link to this table resource

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

### tableType

Type for capturing a column in a table

`tableType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-properties-tabletype)

#### tableType Type

`string`

#### tableType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Regular"` |  |
| `"External"` |  |
| `"View"` |  |
| `"SecureView"` |  |
| `"MaterializedView"` |  |

### fullyQualifiedName

Fully qualified name of the table in the form serviceName.databaseName.tableName

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-properties-fullyqualifiedname)

#### fullyQualifiedName Type

`string`

### columns

Columns in the table

`columns`

* is required
* Type: `object[]` \([Details](../types/basic.md#table-definitions-column)\)
* cannot be null
* defined in: [Table entity](table.md#table-properties-columns)

#### columns Type

`object[]` \([Details](../types/basic.md#table-definitions-column)\)

### tableConstraints

Table constraints

`tableConstraints`

* is optional
* Type: `object[]` \([Details](table.md#table-definitions-tableconstraint)\)
* cannot be null
* defined in: [Table entity](table.md#table-properties-tableconstraints)

#### tableConstraints Type

`object[]` \([Details](table.md#table-definitions-tableconstraint)\)

### usageSummary

Type used to return usage details of an entity

`usageSummary`

* is optional
* Type: `object` \([Type used to return usage details of an entity](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/usagedetails.md)\)
* cannot be null
* defined in: [Usage Details type](../types/usagedetails.md)

#### usageSummary Type

`object` \([Type used to return usage details of an entity](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/usagedetails.md)\)

### owner

Entity reference that includes entity ID and entity type

`owner`

* is optional
* Type: `object` \([Entity Reference](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/entityreference.md)\)
* cannot be null
* defined in: [Entity Reference type](../types/entityreference.md)

#### owner Type

`object` \([Entity Reference](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/entityreference.md)\)

### followers

Followers of this table

`followers`

* is optional
* Type: `object[]` \([Entity Reference](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/entityreference.md)\)
* cannot be null
* defined in: [Entity Reference type](../types/entityreference.md#entityreference-definitions-entityreferencelist)

#### followers Type

`object[]` \([Entity Reference](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/entityreference.md)\)

### database

Entity reference that includes entity ID and entity type

`database`

* is optional
* Type: `object` \([Entity Reference](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/entityreference.md)\)
* cannot be null
* defined in: [Table entity](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/entityreference.md)

#### database Type

`object` \([Entity Reference](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/entityreference.md)\)

### tags

Tags for this table

`tags`

* is optional
* Type: `object[]` \([Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/taglabel.md)\)
* cannot be null
* defined in: [Table entity](table.md#table-properties-tags)

#### tags Type

`object[]` \([Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/taglabel.md)\)

### joins

Details of other tables this table is frequently joined with

`joins`

* is optional
* Type: `object` \([Details](table.md#table-definitions-tablejoins)\)
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tablejoins)

#### joins Type

`object` \([Details](table.md#table-definitions-tablejoins)\)

### sampleData

Information on other tables that this table column is frequently joined with

`sampleData`

* is optional
* Type: `object` \([Details](table.md#table-definitions-tabledata)\)
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tabledata)

#### sampleData Type

`object` \([Details](table.md#table-definitions-tabledata)\)

## Table entity Definitions

### Definitions group tableType

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group columnDataType

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnDataType"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group columnConstraint

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnConstraint"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group tableConstraint

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [constraintType](table.md#constrainttype) | `string` | Optional | cannot be null | [Table entity](table.md#table-definitions-tableconstraint-properties-constrainttype) |
| [columns](table.md#columns-1) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-tableconstraint-properties-columns) |

#### constraintType

`constraintType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tableconstraint-properties-constrainttype)

**constraintType Type**

`string`

**constraintType Constraints**

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"UNIQUE"` |  |
| `"PRIMARY_KEY"` |  |
| `"FOREIGN_KEY"` |  |

#### columns

List of column names corresponding to the constraint

`columns`

* is optional
* Type: `string[]`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tableconstraint-properties-columns)

**columns Type**

`string[]`

### Definitions group columnName

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnName"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group tableName

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableName"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group fullyQualifiedColumnName

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/fullyQualifiedColumnName"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |


### Definitions group column

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](table.md#name-1) | `string` | Required | cannot be null | [Table entity](table.md#table-definitions-columnname) |
| [columnDataType](table.md#columndatatype) | `string` | Required | cannot be null | [Table entity](table.md#table-Definitions-Columndatatype) |
| [description](table.md#description-1) | `string` | Optional | cannot be null | [Table entity](table.md#table-Definitions-Column-Properties-Description) |
| [fullyQualifiedName](table.md#fullyqualifiedname-1) | `string` | Optional | cannot be null | [Table entity](table.md#table-definitions-fullyqualifiedcolumnname) |
| [tags](table.md#tags-1) | `array` | Optional | cannot be null | [Table entity](table.md#table-Definitions-Column-Properties-Tags) |
| [columnConstraint](table.md#columnconstraint) | `string` | Optional | cannot be null | [Table entity](table.md#table-Definitions-Columnconstraint) |
| [ordinalPosition](table.md#ordinalposition) | `integer` | Optional | cannot be null | [Table entity](table.md#table-Definitions-Column-Properties-Ordinalposition) |

#### name

Local name \(not fully qualified name\) of the column

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columnname)

**name Type**

`string`

**name Constraints**

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

#### columnDataType

Type for capturing a column in a table

`columnDataType`

* is required
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-Definitions-Columndatatype)

**columnDataType Type**

`string`

**columnDataType Constraints**

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NUMBER"` |  |
| `"TINYINT"` |  |
| `"SMALLINT"` |  |
| `"INT"` |  |
| `"BIGINT"` |  |
| `"FLOAT"` |  |
| `"DOUBLE"` |  |
| `"DECIMAL"` |  |
| `"NUMERIC"` |  |
| `"TIMESTAMP"` |  |
| `"TIME"` |  |
| `"DATE"` |  |
| `"DATETIME"` |  |
| `"INTERVAL"` |  |
| `"STRING"` |  |
| `"MEDIUMTEXT"` |  |
| `"TEXT"` |  |
| `"CHAR"` |  |
| `"VARCHAR"` |  |
| `"BOOLEAN"` |  |
| `"BINARY"` |  |
| `"VARBINARY"` |  |
| `"ARRAY"` |  |
| `"BLOB"` |  |
| `"LONGBLOB"` |  |
| `"MEDIUMBLOB"` |  |
| `"MAP"` |  |
| `"STRUCT"` |  |
| `"UNION"` |  |
| `"SET"` |  |
| `"GEOGRAPHY"` |  |
| `"ENUM"` |  |
| `"JSON"` |  |

#### description

Description of the column

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-Definitions-Column-Properties-Description)

**description Type**

`string`

#### fullyQualifiedName

Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-fullyqualifiedcolumnname)

**fullyQualifiedName Type**

`string`

**fullyQualifiedName Constraints**

**maximum length**: the maximum number of characters for this string is: `256`

**minimum length**: the minimum number of characters for this string is: `1`

#### tags

Tags associated with the column

`tags`

* is optional
* Type: `object[]` \([Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/taglabel.md)\)
* cannot be null
* defined in: [Table entity](table.md#table-Definitions-Column-Properties-Tags)

**tags Type**

`object[]` \([Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/taglabel.md)\)

#### columnConstraint

Column constraint

`columnConstraint`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-Definitions-Columnconstraint)

**columnConstraint Type**

`string`

**columnConstraint Constraints**

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NULL"` |  |
| `"NOT_NULL"` |  |
| `"UNIQUE"` |  |
| `"PRIMARY_KEY"` |  |

**columnConstraint Default Value**

The default value is:

```javascript
"NULL"
```

#### ordinalPosition

Ordinal position of the column

`ordinalPosition`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Table entity](table.md#table-Definitions-Column-Properties-Ordinalposition)

**ordinalPosition Type**

`integer`

### Definitions group columnJoins

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [columnName](table.md#columnname) | `string` | Optional | cannot be null | [Table entity](table.md#table-definitions-columnname) |
| [joinedWith](table.md#joinedwith) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-columnjoins-properties-joinedwith) |

#### columnName

Local name \(not fully qualified name\) of the column

`columnName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columnname)

**columnName Type**

`string`

**columnName Constraints**

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

#### joinedWith

Fully qualified names of the columns that this column is joined with

`joinedWith`

* is optional
* Type: `object[]` \([Details](table.md#table-definitions-columnjoins-properties-joinedwith-items)\)
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columnjoins-properties-joinedwith)

**joinedWith Type**

`object[]` \([Details](table.md#table-definitions-columnjoins-properties-joinedwith-items)\)

### Definitions group tableJoins

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [startDate](table.md#startdate) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-date) |
| [dayCount](table.md#daycount) | `integer` | Optional | cannot be null | [Table entity](table.md#table-definitions-tablejoins-properties-daycount) |
| [columnJoins](table.md#columnjoins) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-tablejoins-properties-columnjoins) |

#### startDate

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

`startDate`

* is optional
* Type: `string`
* cannot be null
* defined in: [Basic type](../types/basic.md#basic-definitions-date)

**startDate Type**

`string`

**startDate Constraints**

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

#### dayCount

`dayCount`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tablejoins-properties-daycount)

**dayCount Type**

`integer`

**dayCount Default Value**

The default value is:

```javascript
1
```

#### columnJoins

`columnJoins`

* is optional
* Type: `object[]` \([Details](table.md#table-definitions-columnjoins)\)
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tablejoins-properties-columnjoins)

**columnJoins Type**

`object[]` \([Details](table.md#table-definitions-columnjoins)\)

### Definitions group tableData

Reference this group by using

```javascript
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData"}
```

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [columns](table.md#columns-2) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-tabledata-properties-columns) |
| [rows](table.md#rows) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-tabledata-properties-rows) |

#### columns

List of local column names \(not fully qualified column names\) of the table

`columns`

* is optional
* Type: `string[]`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tabledata-properties-columns)

**columns Type**

`string[]`

#### rows

Data for a multiple rows of the table

`rows`

* is optional
* Type: `array[]`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tabledata-properties-rows)

**rows Type**

`array[]`

## table-definitions-column-properties-description

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/description
```

Description of the column

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### description Type

`string`

## table-definitions-column-properties-ordinalposition

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/ordinalPosition
```

Ordinal position of the column

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### ordinalPosition Type

`integer`

## table-definitions-column-properties-tags

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/tags
```

Tags associated with the column

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### tags Type

`object[]` \([Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/taglabel.md)\)

## table-definitions-column

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/columns/items
```

Type for capturing a column in a table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [createTable.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json) |

### items Type

`object` \([Details](../types/basic.md#table-definitions-column)\)

## items Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [name](table.md#name) | `string` | Required | cannot be null | [Table entity](table.md#table-definitions-columnname) |
| [columnDataType](table.md#columndatatype) | `string` | Required | cannot be null | [Table entity](table.md#table-definitions-columndatatype) |
| [description](table.md#description) | `string` | Optional | cannot be null | [Table entity](table.md#table-Definitions-Column-Properties-Description) |
| [fullyQualifiedName](table.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Table entity](table.md#table-definitions-fullyqualifiedcolumnname) |
| [tags](table.md#tags) | `array` | Optional | cannot be null | [Table entity](table.md#table-Definitions-Column-Properties-Tags) |
| [columnConstraint](table.md#columnconstraint) | `string` | Optional | cannot be null | [Table entity](table.md#table-definitions-columnconstraint) |
| [ordinalPosition](table.md#ordinalposition) | `integer` | Optional | cannot be null | [Table entity](table.md#table-Definitions-Column-Properties-Ordinalposition) |

### name

Local name \(not fully qualified name\) of the column

`name`

* is required
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columnname)

#### name Type

`string`

#### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

### columnDataType

Type for capturing a column in a table

`columnDataType`

* is required
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columndatatype)

#### columnDataType Type

`string`

#### columnDataType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NUMBER"` |  |
| `"TINYINT"` |  |
| `"SMALLINT"` |  |
| `"INT"` |  |
| `"BIGINT"` |  |
| `"FLOAT"` |  |
| `"DOUBLE"` |  |
| `"DECIMAL"` |  |
| `"NUMERIC"` |  |
| `"TIMESTAMP"` |  |
| `"TIME"` |  |
| `"DATE"` |  |
| `"DATETIME"` |  |
| `"INTERVAL"` |  |
| `"STRING"` |  |
| `"MEDIUMTEXT"` |  |
| `"TEXT"` |  |
| `"CHAR"` |  |
| `"VARCHAR"` |  |
| `"BOOLEAN"` |  |
| `"BINARY"` |  |
| `"VARBINARY"` |  |
| `"ARRAY"` |  |
| `"BLOB"` |  |
| `"LONGBLOB"` |  |
| `"MEDIUMBLOB"` |  |
| `"MAP"` |  |
| `"STRUCT"` |  |
| `"UNION"` |  |
| `"SET"` |  |
| `"GEOGRAPHY"` |  |
| `"ENUM"` |  |
| `"JSON"` |  |

### description

Description of the column

`description`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-Definitions-Column-Properties-Description)

#### description Type

`string`

### fullyQualifiedName

Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-fullyqualifiedcolumnname)

#### fullyQualifiedName Type

`string`

#### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `256`

**minimum length**: the minimum number of characters for this string is: `1`

### tags

Tags associated with the column

`tags`

* is optional
* Type: `object[]` \([Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/taglabel.md)\)
* cannot be null
* defined in: [Table entity](table.md#table-Definitions-Column-Properties-Tags)

#### tags Type

`object[]` \([Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/taglabel.md)\)

### columnConstraint

Column constraint

`columnConstraint`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columnconstraint)

#### columnConstraint Type

`string`

#### columnConstraint Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NULL"` |  |
| `"NOT_NULL"` |  |
| `"UNIQUE"` |  |
| `"PRIMARY_KEY"` |  |

#### columnConstraint Default Value

The default value is:

```javascript
"NULL"
```

### ordinalPosition

Ordinal position of the column

`ordinalPosition`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Table entity](table.md#table-Definitions-Column-Properties-Ordinalposition)

#### ordinalPosition Type

`integer`

## table-definitions-columnconstraint

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnConstraint
```

Column constraint

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### columnConstraint Type

`string`

### columnConstraint Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NULL"` |  |
| `"NOT_NULL"` |  |
| `"UNIQUE"` |  |
| `"PRIMARY_KEY"` |  |

### columnConstraint Default Value

The default value is:

```javascript
"NULL"
```

## table-definitions-columndatatype

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/columnDataType
```

Type for capturing a column in a table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### columnDataType Type

`string`

### columnDataType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"NUMBER"` |  |
| `"TINYINT"` |  |
| `"SMALLINT"` |  |
| `"INT"` |  |
| `"BIGINT"` |  |
| `"FLOAT"` |  |
| `"DOUBLE"` |  |
| `"DECIMAL"` |  |
| `"NUMERIC"` |  |
| `"TIMESTAMP"` |  |
| `"TIME"` |  |
| `"DATE"` |  |
| `"DATETIME"` |  |
| `"INTERVAL"` |  |
| `"STRING"` |  |
| `"MEDIUMTEXT"` |  |
| `"TEXT"` |  |
| `"CHAR"` |  |
| `"VARCHAR"` |  |
| `"BOOLEAN"` |  |
| `"BINARY"` |  |
| `"VARBINARY"` |  |
| `"ARRAY"` |  |
| `"BLOB"` |  |
| `"LONGBLOB"` |  |
| `"MEDIUMBLOB"` |  |
| `"MAP"` |  |
| `"STRUCT"` |  |
| `"UNION"` |  |
| `"SET"` |  |
| `"GEOGRAPHY"` |  |
| `"ENUM"` |  |
| `"JSON"` |  |

## table-definitions-columnjoins-properties-joinedwith-items-properties-joincount

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith/items/properties/joinCount
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### joinCount Type

`integer`

## table-definitions-columnjoins-properties-joinedwith-items

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith/items
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### items Type

`object` \([Details](table.md#table-definitions-columnjoins-properties-joinedwith-items)\)

## items Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [fullyQualifiedName](table.md#fullyqualifiedname) | `string` | Optional | cannot be null | [Table entity](table.md#table-definitions-fullyqualifiedcolumnname) |
| [joinCount](table.md#joincount) | `integer` | Optional | cannot be null | [Table entity](table.md#table-definitions-columnjoins-properties-joinedwith-items-properties-joincount) |

### fullyQualifiedName

Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName

`fullyQualifiedName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-fullyqualifiedcolumnname)

#### fullyQualifiedName Type

`string`

#### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `256`

**minimum length**: the minimum number of characters for this string is: `1`

### joinCount

`joinCount`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columnjoins-properties-joinedwith-items-properties-joincount)

#### joinCount Type

`integer`

## table-definitions-columnjoins-properties-joinedwith

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/columnJoins/properties/joinedWith
```

Fully qualified names of the columns that this column is joined with

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### joinedWith Type

`object[]` \([Details](table.md#table-definitions-columnjoins-properties-joinedwith-items)\)

## table-definitions-columnjoins

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/columnJoins/items
```

Information on other tables that this table column is frequently joined with

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Forbidden | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### items Type

`object` \([Details](table.md#table-definitions-columnjoins)\)

## items Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [columnName](table.md#columnname) | `string` | Optional | cannot be null | [Table entity](table.md#table-definitions-columnname) |
| [joinedWith](table.md#joinedwith) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-columnjoins-properties-joinedwith) |

### columnName

Local name \(not fully qualified name\) of the column

`columnName`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columnname)

#### columnName Type

`string`

#### columnName Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

### joinedWith

Fully qualified names of the columns that this column is joined with

`joinedWith`

* is optional
* Type: `object[]` \([Details](table.md#table-definitions-columnjoins-properties-joinedwith-items)\)
* cannot be null
* defined in: [Table entity](table.md#table-definitions-columnjoins-properties-joinedwith)

#### joinedWith Type

`object[]` \([Details](table.md#table-definitions-columnjoins-properties-joinedwith-items)\)

## table-definitions-columnname

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/name
```

Local name \(not fully qualified name\) of the column

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

## table-definitions-fullyqualifiedcolumnname

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/column/properties/fullyQualifiedName
```

Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### fullyQualifiedName Type

`string`

### fullyQualifiedName Constraints

**maximum length**: the maximum number of characters for this string is: `256`

**minimum length**: the minimum number of characters for this string is: `1`

## table-definitions-tableconstraint-properties-columns-items

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/columns/items
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### items Type

`string`

## table-definitions-tableconstraint-properties-columns

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/columns
```

List of column names corresponding to the constraint

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### columns Type

`string[]`

## table-definitions-tableconstraint-properties-constrainttype

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableConstraint/properties/constraintType
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### constraintType Type

`string`

### constraintType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"UNIQUE"` |  |
| `"PRIMARY_KEY"` |  |
| `"FOREIGN_KEY"` |  |

## table-definitions-tableconstraint

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/tableConstraints/items
```

Table constraint

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [createTable.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json) |

### items Type

`object` \([Details](table.md#table-definitions-tableconstraint)\)

## items Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [constraintType](table.md#constrainttype) | `string` | Optional | cannot be null | [Table entity](table.md#table-definitions-tableconstraint-properties-constrainttype) |
| [columns](table.md#columns) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-tableconstraint-properties-columns) |

### constraintType

`constraintType`

* is optional
* Type: `string`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tableconstraint-properties-constrainttype)

#### constraintType Type

`string`

#### constraintType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"UNIQUE"` |  |
| `"PRIMARY_KEY"` |  |
| `"FOREIGN_KEY"` |  |

### columns

List of column names corresponding to the constraint

`columns`

* is optional
* Type: `string[]`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tableconstraint-properties-columns)

#### columns Type

`string[]`

## table-definitions-tabledata-properties-columns

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/columns
```

List of local column names \(not fully qualified column names\) of the table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### columns Type

`string[]`

## table-definitions-tabledata-properties-rows-items

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/rows/items
```

Data for a single row of the table with in the same order as columns fields

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### items Type

`array`

## table-definitions-tabledata-properties-rows

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableData/properties/rows
```

Data for a multiple rows of the table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### rows Type

`array[]`

## table-definitions-tabledata

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/sampleData
```

Information on other tables that this table column is frequently joined with

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Forbidden | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### sampleData Type

`object` \([Details](table.md#table-definitions-tabledata)\)

## sampleData Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [columns](table.md#columns) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-tabledata-properties-columns) |
| [rows](table.md#rows) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-tabledata-properties-rows) |

### columns

List of local column names \(not fully qualified column names\) of the table

`columns`

* is optional
* Type: `string[]`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tabledata-properties-columns)

#### columns Type

`string[]`

### rows

Data for a multiple rows of the table

`rows`

* is optional
* Type: `array[]`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tabledata-properties-rows)

#### rows Type

`array[]`

## table-definitions-tablejoins-properties-columnjoins

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/columnJoins
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### columnJoins Type

`object[]` \([Details](table.md#table-definitions-columnjoins)\)

## table-definitions-tablejoins-properties-daycount

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableJoins/properties/dayCount
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### dayCount Type

`integer`

### dayCount Default Value

The default value is:

```javascript
1
```

## table-definitions-tablejoins

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/joins
```

Details of other tables this table is frequently joined with

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Forbidden | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### joins Type

`object` \([Details](table.md#table-definitions-tablejoins)\)

## joins Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [startDate](table.md#startdate) | `string` | Optional | cannot be null | [Basic type](../types/basic.md#basic-definitions-date) |
| [dayCount](table.md#daycount) | `integer` | Optional | cannot be null | [Table entity](table.md#table-definitions-tablejoins-properties-daycount) |
| [columnJoins](table.md#columnjoins) | `array` | Optional | cannot be null | [Table entity](table.md#table-definitions-tablejoins-properties-columnjoins) |

### startDate

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

`startDate`

* is optional
* Type: `string`
* cannot be null
* defined in: [Basic type](../types/basic.md#basic-definitions-date)

#### startDate Type

`string`

#### startDate Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339)

### dayCount

`dayCount`

* is optional
* Type: `integer`
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tablejoins-properties-daycount)

#### dayCount Type

`integer`

#### dayCount Default Value

The default value is:

```javascript
1
```

### columnJoins

`columnJoins`

* is optional
* Type: `object[]` \([Details](table.md#table-definitions-columnjoins)\)
* cannot be null
* defined in: [Table entity](table.md#table-definitions-tablejoins-properties-columnjoins)

#### columnJoins Type

`object[]` \([Details](table.md#table-definitions-columnjoins)\)

## table-definitions-tablename

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/name
```

Local name \(not fully qualified name\) of the table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [createTable.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

## table-definitions-tabletype-javaenums-0

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/0
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### 0 Type

unknown

## table-definitions-tabletype-javaenums-1

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/1
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### 1 Type

unknown

## table-definitions-tabletype-javaenums-2

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/2
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### 2 Type

unknown

## table-definitions-tabletype-javaenums-3

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/3
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### 3 Type

unknown

## table-definitions-tabletype-javaenums-4

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions/tableType/javaEnums/4
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### 4 Type

unknown

## table-definitions-tabletype

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json#/properties/tableType
```

Type for capturing a column in a table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [createTable.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/api/data/createTable.json) |

### tableType Type

`string`

### tableType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Regular"` |  |
| `"External"` |  |
| `"View"` |  |
| `"SecureView"` |  |
| `"MaterializedView"` |  |

## table-definitions

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/definitions
```

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### definitions Type

unknown

## table-properties-columns

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/columns
```

Columns in the table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### columns Type

`object[]` \([Details](../types/basic.md#table-definitions-column)\)

## table-properties-description

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/description
```

Description of the table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### description Type

`string`

## table-properties-fullyqualifiedname

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/fullyQualifiedName
```

Fully qualified name of the table in the form serviceName.databaseName.tableName

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### fullyQualifiedName Type

`string`

## table-properties-name

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/name
```

Local name \(not fully qualified name\) of the table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### name Type

`string`

### name Constraints

**maximum length**: the maximum number of characters for this string is: `64`

**minimum length**: the minimum number of characters for this string is: `1`

**pattern**: the string must match the following regular expression:

```text
^[^.]*$
```

[try pattern](https://regexr.com/?expression=%5E%5B%5E.%5D*%24)

## table-properties-tableconstraints

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tableConstraints
```

Table constraints

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### tableConstraints Type

`object[]` \([Details](table.md#table-definitions-tableconstraint)\)

## table-properties-tabletype

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tableType
```

Type for capturing a column in a table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### tableType Type

`string`

### tableType Constraints

**enum**: the value of this property must be equal to one of the following values:

| Value | Explanation |
| :--- | :--- |
| `"Regular"` |  |
| `"External"` |  |
| `"View"` |  |
| `"SecureView"` |  |
| `"MaterializedView"` |  |

## table-properties-tags

```text
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#/properties/tags
```

Tags for this table

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [table.json\*](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/https:/github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json) |

### tags Type

`object[]` \([Tag Label](https://github.com/open-metadata/OpenMetadata/tree/88ab3784a5a9e2cfcf56bbb144522498eb33184c/docs/openmetadata-apis/schemas/entities/taglabel.md)\)

