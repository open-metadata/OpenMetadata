# Pipeline

This schema defines the Pipeline entity. A pipeline enables the flow of data from source to destination through a series of processing steps. ETL is a type of pipeline where the series of steps Extract, Transform and Load the data.

**$id: **[**https://open-metadata.org/schema/entity/data/pipeline.json**](https://open-metadata.org/schema/entity/data/pipeline.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier that identifies a pipeline instance.
  * $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
* **name** `required`
  * Name that identifies this pipeline instance uniquely.
  * Type: `string`
  * Length: between 1 and 64
* **displayName**
  * Display Name that identifies this Pipeline. It could be title or label from the source services.
  * Type: `string`
* **fullyQualifiedName**
  * A unique name that identifies a pipeline in the format 'ServiceName.PipelineName'.
  * Type: `string`
  * Length: between 1 and 64
* **description**
  * Description of this Pipeline.
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
* **pipelineUrl**
  * Pipeline URL to visit/manage. This URL points to respective pipeline service UI.
  * Type: `string`
  * String format must be a "uri"
* **concurrency**
  * Concurrency of the Pipeline.
  * Type: `integer`
* **pipelineLocation**
  * Pipeline Code Location.
  * Type: `string`
* **startDate**
  * Start date of the workflow.
  * $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
* **tasks**
  * All the tasks that are part of pipeline.
  * Type: `array`
    * **Items**
    * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **followers**
  * Followers of this Pipeline.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
* **tags**
  * Tags for this Pipeline.
  * Type: `array`
    * **Items**
    * $ref: [../../type/tagLabel.json](../types/taglabel.md)
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
* **owner**
  * Owner of this pipeline.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **service** `required`
  * Link to service where this pipeline is hosted in.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)

_This document was updated on: Monday, October 18, 2021_
