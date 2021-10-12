# Model

This schema defines the Model entity. Models are algorithms trained on data to find patterns or make predictions.

**$id: https://open-metadata.org/schema/entity/data/model.json**

Type: `object`

## Properties
 - **id** `required`
   - Unique identifier of a model instance.
   - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
   - Name that identifies this model.
   - Type: `string`
   - Length: between 1 and 64
 - **fullyQualifiedName**
   - A unique name that identifies a model.
   - Type: `string`
   - Length: between 1 and 64
 - **displayName**
   - Display Name that identifies this model.
   - Type: `string`
 - **description**
   - Description of the model, what it is, and how to use it.
   - Type: `string`
 - **algorithm** `required`
   - Algorithm used to train the model.
   - Type: `string`
 - **dashboard**
   - Performance Dashboard URL to track metric evolution.
   - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **href**
   - Link to the resource corresponding to this entity.
   - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **owner**
   - Owner of this model.
   - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **followers**
   - Followers of this model.
   - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **tags**
   - Tags for this model.
   - Type: `array`
     - **Items**
     - $ref: [../../type/tagLabel.json](../types/taglabel.md)
 - **usageSummary**
   - Latest usage information for this model.
   - $ref: [../../type/usageDetails.json](../types/usagedetails.md)


_This document was updated on: Tuesday, October 12, 2021_