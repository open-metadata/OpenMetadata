# DbtModel

This schema defines the DbtModel entity. A DbtModel organizes data modeling details , sql and columns.

**$id:**[**https://open-metadata.org/schema/entity/data/dbtmodel.json**](https://open-metadata.org/schema/entity/data/dbtmodel.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
- **id** `required`
  - Unique identifier of this model instance.
  - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
- **name** `required`
  - Name of a model. Expected to be unique within a database.
  - $ref: [#/definitions/dbtModelName](#dbtmodelname)
- **displayName**
  - Display Name that identifies this model. It could be title or label from the source services.
  - Type: `string`
- **fullyQualifiedName**
  - Fully qualified name of a model in the form `serviceName.databaseName.dbtModelName`.
  - Type: `string`
- **description**
  - Description of a DBT Model.
  - Type: `string`
- **version**
  - Metadata version of the entity.
  - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
- **updatedAt**
  - Last update time corresponding to the new version of the entity.
  - $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
- **updatedBy**
  - User who made the update.
  - Type: `string`
- **href**
  - Link to this table resource.
  - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
- **dbtNodeType**
  - $ref: [#/definitions/dbtNodeType](#dbtnodetype)
- **dbtCatalogType**
  - $ref: [#/definitions/dbtCatalogType](#dbtcatalogtype)
- **dbtMaterializationType**
  - $ref: [#/definitions/dbtMaterializationType](#dbtmaterializationtype)
- **columns** `required`
  - Columns in this DBT Model.
  - Type: `array`
    - **Items**
    - $ref: [./table.json#/definitions/column](./table.md#column)
- **owner**
  - Owner of this DBT Model.
  - $ref: [../../type/entityReference.json](../types/entityreference.md)
- **database**
  - Reference to Database that uses this DBT Model.
  - $ref: [../../type/entityReference.json](../types/entityreference.md)
- **viewDefinition**
  - View Definition in SQL.
  - $ref: [../../type/basic.json#/definitions/sqlQuery](../types/basic.md#sqlquery)
- **tags**
  - Tags for this DBT.
  - Type: `array`
    - **Items**
    - $ref: [../../type/tagLabel.json](../types/taglabel.md)
- **followers**
  - Followers of this table.
  - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
- **changeDescription**
  - Change that lead to this version of the entity.
  - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)


## Type definitions in this schema
### dbtNodeType

- This schema defines the type used for describing different types of Nodes in DBT.
- Type: `string`
- The value is restricted to the following:  
  1. _"Seed"_
  2. _"Model"_


### dbtCatalogType

- This schema defines the type used for describing different catalog type.
- Type: `string`
- The value is restricted to the following:  
  1. _"BaseTable"_


### dbtMaterializationType

- This schema defines the type used for describing different materialization type.
- Type: `string`
- The value is restricted to the following: 
  1. _"Table"_
  2. _"Seed"_


### dbtModelName

- Local name (not fully qualified name) of a table.
- Type: `string`
- The value must match this pattern: `^[^.]*$`
- Length: between 1 and 128


### fullyQualifiedColumnName

- Fully qualified name of the column that includes `serviceName.databaseName.tableName.columnName[.nestedColumnName]`. When columnName is null for dataType struct fields, `field_#` where `#` is field index is used. For map dataType, for key the field name `key` is used and for the value field `value` is used.
- Type: `string`
- Length: between 1 and 256

_This document was updated on: Tuesday, December 14, 2021_