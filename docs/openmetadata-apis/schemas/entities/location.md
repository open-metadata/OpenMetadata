# Location

This schema defines the Location entity. A Location can contain the data of a table or group other sublocation together.

**$id:**[**https://open-metadata.org/schema/entity/data/location.json**](https://open-metadata.org/schema/entity/data/location.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
- **id**
  - Unique identifier of this location instance.
  - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
- **name** `required`
  - Name of a location without the service. For example s3://bucket/path1/path2.
  - $ref: [#/definitions/locationName](#locationname)
- **displayName**
  - Display Name that identifies this table. It could be title or label from the source services.
  - Type: `string`
- **fullyQualifiedName**
  - Fully qualified name of a location in the form `serviceName.locationName`.
  - Type: `string`
- **description**
  - Description of a location.
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
  - Link to this location resource.
  - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
- **locationType**
  - $ref: [#/definitions/locationType](#locationtype)
- **owner**
  - Owner of this location.
  - $ref: [../../type/entityReference.json](../types/entityreference.md)
- **followers**
  - Followers of this location.
  - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
- **tags**
  - Tags for this location.
  - Type: `array`
    - **Items**
    - $ref: [../../type/tagLabel.json](../types/taglabel.md)
- **service** `required`
  - Link to the database cluster/service where this database is hosted in.
  - $ref: [../../type/entityReference.json](../types/entityreference.md)
- **serviceType**
    - Service type where this storage location is hosted in.
    - $ref: [../../type/storage.json#/definitions/storageServiceType](../types/storage.md#storageservicetype)
- **changeDescription**
  - Change that lead to this version of the entity.
  - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)


## Type definitions in this schema
### locationName
- Local name (not fully qualified name) of a location.
- Type: `string`
- Length: between 1 and 128


### locationType

- This schema defines the type used for describing different types of Location.
- Type: `string`
- The value is restricted to the following: 
  1. _"Bucket"_
  2. _"Prefix"_
  3. _"Database"_
  4. _"Table"_
   

_This document was updated on: Tuesday, December 14, 2021_