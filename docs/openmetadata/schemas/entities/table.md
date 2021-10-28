# Table

This schema defines the Table entity. A Table organizes data in rows and columns and is defined by a Schema. OpenMetadata does not have a separate abstraction for Schema. Both Table and Schema are captured in this entity.

**$id: **[**https://open-metadata.org/schema/entity/data/table.json**](https://open-metadata.org/schema/entity/data/table.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier of this table instance.
  * $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
* **name** `required`
  * Name of a table. Expected to be unique within a database.
  * $ref: [#/definitions/tableName](table.md#tablename)
* **displayName**
  * Display Name that identifies this table. It could be title or label from the source services.
  * Type: `string`
* **fullyQualifiedName**
  * Fully qualified name of a table in the form `serviceName.databaseName.tableName`.
  * Type: `string`
* **description**
  * Description of a table.
  * Type: `string`
* **version**
  * Metadata version of the entity.
  * $ref: [../../type/basic.json#/definitions/entityVersion](../types/basic.md#entityversion)
* **updatedAt**
  * Last update time corresponding to the new version of the entity.
  * $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
* **updatedBy**
  * User who made the update.
  * Type: `string`
* **href**
  * Link to this table resource.
  * $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
* **tableType**
  * $ref: [#/definitions/tableType](table.md#tabletype)
* **columns** `required`
  * Columns in this table.
  * Type: `array`
    * **Items**
    * $ref: [#/definitions/column](table.md#column)
* **tableConstraints**
  * Table constraints.
  * Type: `array`
    * **Items**
    * $ref: [#/definitions/tableConstraint](table.md#tableconstraint)
* **owner**
  * Owner of this table.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **database**
  * Reference to Database that contains this table.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **viewDefinition**
  * View Definition in SQL. Applies to TableType.View only.
  * $ref: [../../type/basic.json#/definitions/sqlQuery](../types/basic.md#sqlquery)
* **tags**
  * Tags for this table.
  * Type: `array`
    * **Items**
    * $ref: [../../type/tagLabel.json](../types/taglabel.md)
* **usageSummary**
  * Latest usage information for this table.
  * $ref: [../../type/usageDetails.json](../types/usagedetails.md)
* **followers**
  * Followers of this table.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
* **joins**
  * Details of other tables this table is frequently joined with.
  * $ref: [#/definitions/tableJoins](table.md#tablejoins)
* **sampleData**
  * Sample data for a table.
  * $ref: [#/definitions/tableData](table.md#tabledata)
* **tableProfile**
  * Data profile for a table.
  * Type: `array`
    * **Items**
    * $ref: [#/definitions/tableProfile](table.md#tableprofile)

## Type definitions in this schema

### tableType

* This schema defines the type used for describing different types of tables.
* Type: `string`
* The value is restricted to the following:
  1. _"Regular"_
  2. _"External"_
  3. _"View"_
  4. _"SecureView"_
  5. _"MaterializedView"_

### dataType

* This enum defines the type of data stored in a column.
* Type: `string`
* The value is restricted to the following:
  1. _"NUMBER"_
  2. _"TINYINT"_
  3. _"SMALLINT"_
  4. _"INT"_
  5. _"BIGINT"_
  6. _"BYTEINT"_
  7. _"FLOAT"_
  8. _"DOUBLE"_
  9. _"DECIMAL"_
  10. _"NUMERIC"_
  11. _"TIMESTAMP"_
  12. _"TIME"_
  13. _"DATE"_
  14. _"DATETIME"_
  15. _"INTERVAL"_
  16. _"STRING"_
  17. _"MEDIUMTEXT"_
  18. _"TEXT"_
  19. _"CHAR"_
  20. _"VARCHAR"_
  21. _"BOOLEAN"_
  22. _"BINARY"_
  23. _"VARBINARY"_
  24. _"ARRAY"_
  25. _"BLOB"_
  26. _"LONGBLOB"_
  27. _"MEDIUMBLOB"_
  28. _"MAP"_
  29. _"STRUCT"_
  30. _"UNION"_
  31. _"SET"_
  32. _"GEOGRAPHY"_
  33. _"ENUM"_
  34. _"JSON"_

### constraint

* This enum defines the type for column constraint.
* Type: `string`
* The value is restricted to the following:
  1. _"NULL"_
  2. _"NOT\_NULL"_
  3. _"UNIQUE"_
  4. _"PRIMARY\_KEY"_

### tableConstraint

* This enum defines the type for table constraint.
* Type: `object`
* **Properties**
  * **constraintType**
    * Type: `string`
    * The value is restricted to the following:
      1. _"UNIQUE"_
      2. _"PRIMARY\_KEY"_
      3. _"FOREIGN\_KEY"_
  * **columns**
    * List of column names corresponding to the constraint.
    * Type: `array`
      * **Items**
      * Type: `string`

### columnName

* Local name (not fully qualified name) of the column. ColumnName is `-` when the column is not named in struct dataType. For example, BigQuery supports struct with unnamed fields.
* Type: `string`
* The value must match this pattern: `^[^.]*$`
* Length: between 1 and 64

### tableName

* Local name (not fully qualified name) of a table.
* Type: `string`
* The value must match this pattern: `^[^.]*$`
* Length: between 1 and 64

### fullyQualifiedColumnName

* Fully qualified name of the column that includes `serviceName.databaseName.tableName.columnName[.nestedColumnName]`. When columnName is null for dataType struct fields, `field_#` where `#` is field index is used. For map dataType, for key the field name `key` is used and for the value field `value` is used.
* Type: `string`
* Length: between 1 and 256

### column

* This schema defines the type for a column in a table.
* Type: `object`
* This schema does not accept additional properties.
* **Properties**
  * **name** `required`
    * $ref: [#/definitions/columnName](table.md#columnname)
  * **dataType** `required`
    * Data type of the column (int, date etc.).
    * $ref: [#/definitions/dataType](table.md#datatype)
  * **arrayDataType**
    * Data type used array in dataType. For example, `array<int>` has dataType as `array` and arrayDataType as `int`.
    * $ref: [#/definitions/dataType](table.md#datatype)
  * **dataLength**
    * Length of `char`, `varchar`, `binary`, `varbinary` `dataTypes`, else null. For example, `varchar(20)` has dataType as `varchar` and dataLength as `20`.
    * Type: `integer`
  * **dataTypeDisplay**
    * Display name used for dataType. This is useful for complex types, such as \`array, map\<int,string>, struct<>, and union types.
    * Type: `string`
  * **description**
    * Description of the column.
    * Type: `string`
  * **fullyQualifiedName**
    * $ref: [#/definitions/fullyQualifiedColumnName](table.md#fullyqualifiedcolumnname)
  * **tags**
    * Tags associated with the column.
    * Type: `array`
      * **Items**
      * $ref: [../../type/tagLabel.json](../types/taglabel.md)
  * **constraint**
    * Column level constraint.
    * $ref: [#/definitions/constraint](table.md#constraint)
  * **ordinalPosition**
    * Ordinal position of the column.
    * Type: `integer`
  * **jsonSchema**
    * Json schema only if the dataType is JSON else null.
    * Type: `string`
  * **children**
    * Child columns if dataType or arrayDataType is `map`, `struct`, or `union` else `null`.
    * Type: `array`
      * **Items**
      * $ref: [#/definitions/column](table.md#column)

### columnJoins

* This schema defines the type to capture how frequently a column is joined with columns in the other tables.
* Type: `object`
* This schema does not accept additional properties.
* **Properties**
  * **columnName**
    * $ref: [#/definitions/columnName](table.md#columnname)
  * **joinedWith**
    * Fully qualified names of the columns that this column is joined with.
    * Type: `array`
      * **Items**
      * Type: `object`
      * **Properties**
        * **fullyQualifiedName**
          * $ref: [#/definitions/fullyQualifiedColumnName](table.md#fullyqualifiedcolumnname)
        * **joinCount**
          * Type: `integer`

### tableJoins

* This schema defines the type to capture information about how columns in this table are joined with columns in the other tables.
* Type: `object`
* This schema does not accept additional properties.
* **Properties**
  * **startDate**
    * Date can be only from today going back to last 29 days.
    * $ref: [../../type/basic.json#/definitions/date](../types/basic.md#date)
  * **dayCount**
    * Type: `integer`
    * Default: `1`
  * **columnJoins**
    * Type: `array`
      * **Items**
      * $ref: [#/definitions/columnJoins](table.md#columnjoins)

### tableData

* This schema defines the type to capture rows of sample data for a table.
* Type: `object`
* This schema does not accept additional properties.
* **Properties**
  * **columns**
    * List of local column names (not fully qualified column names) of the table.
    * Type: `array`
      * **Items**
      * $ref: [#/definitions/columnName](table.md#columnname)
    * **rows**
      * Data for multiple rows of the table.
      * Type: `array`
        * **Items**
        * Data for a single row of the table within the same order as columns fields.
        * Type: `array`

### columnProfile

* This schema defines the type to capture the table's column profile.
* Type: `object`
* **Properties**
  * **name**
    * Column Name.
    * Type: `string`
  * **uniqueCount**
    * No. of unique values in the column.
    * Type: `number`
  * **uniqueProportion**
    * Proportion of number of unique values in a column.
    * Type: `number`
  * **nullCount**
    * No.of null values in a column.
    * Type: `number`
  * **nullProportion**
    * No.of null value proportion in columns.
    * Type: `number`
  * **min**
    * Minimum value in a column.
    * Type: `string`
  * **max**
    * Maximum value in a column.
    * Type: `string`
  * **mean**
    * Avg value in a column.
    * Type: `string`
  * **median**
    * Median value in a column.
    * Type: `string`
  * **stddev**
    * Standard deviation of a column.
    * Type: `number`

### tableProfile

* This schema defines the type to capture the table's data profile.
* Type: `object`
* This schema does not accept additional properties.
* **Properties**
  * **profileDate**
    * Data one which profile is taken.
    * $ref: [../../type/basic.json#/definitions/date](../types/basic.md#date)
  * **columnCount**
    * No.of columns in the table.
    * Type: `number`
  * **rowCount**
    * No.of rows in the table.
    * Type: `number`
  * **columnProfile**
    * List of local column profiles of the table.
    * Type: `array`
      * **Items**
      * $ref: [#/definitions/columnProfile](table.md#columnprofile)

_This document was updated on: Monday, October 18, 2021_
