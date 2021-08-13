# Pipeline

This schema defines the Pipeline entity. A pipeline enables flow of data from source to destination through a series of processing steps. ETL is a type of pipeline where the series of steps Extract, Transform, and load the data.

<b id="httpsopen-metadata.orgschemaentitydatapipeline.json">&#36;id: https://open-metadata.org/schema/entity/data/pipeline.json</b>

Type: `object`

## Properties
 - <b id="#https://open-metadata.org/schema/entity/data/pipeline.json/properties/id">id</b> `required`
	 - Unique identifier that identifies a pipeline instance.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://open-metadata.org/schema/entity/data/pipeline.json/properties/name">name</b> `required`
	 - Name that identifies this pipeline instance uniquely.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://open-metadata.org/schema/entity/data/pipeline.json/properties/fullyQualifiedName">fullyQualifiedName</b>
	 - A unique name that identifies a pipeline in the format 'ServiceName.PipelineName'.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://open-metadata.org/schema/entity/data/pipeline.json/properties/description">description</b>
	 - Description of this pipeline.
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/entity/data/pipeline.json/properties/href">href</b>
	 - Link to the resource corresponding to this entity.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://open-metadata.org/schema/entity/data/pipeline.json/properties/owner">owner</b>
	 - Owner of this pipeline.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://open-metadata.org/schema/entity/data/pipeline.json/properties/service">service</b> `required`
	 - Link to service where this pipeline is hosted in.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
