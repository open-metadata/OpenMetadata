# Pipeline

This schema defines the Pipeline entity. A pipeline enables flow of data from source to destination through a series of processing steps. ETL is a type of pipeline where the series of steps Extract, Transform, and load the data.

**$id:** [**https://open-metadata.org/schema/entity/data/pipeline.json**](https://open-metadata.org/schema/entity/data/pipeline.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier that identifies a pipeline instance.
  * $ref: [../../type/basic.json\#/definitions/uuid](pipeline.md#....typebasic.jsondefinitionsuuid)
* **name** `required`
  * Name that identifies this pipeline instance uniquely.
  * Type: `string`
  * Length: between 1 and 64
* **fullyQualifiedName**
  * A unique name that identifies a pipeline in the format 'ServiceName.PipelineName'.
  * Type: `string`
  * Length: between 1 and 64
* **description**
  * Description of this pipeline.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json\#/definitions/href](pipeline.md#....typebasic.jsondefinitionshref)
* **owner**
  * Owner of this pipeline.
  * $ref: [../../type/entityReference.json](pipeline.md#....typeentityreference.json)
* **service** `required`
  * Link to service where this pipeline is hosted in.
  * $ref: [../../type/entityReference.json](pipeline.md#....typeentityreference.json)

