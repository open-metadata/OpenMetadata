# Metrics

This schema defines the Metrics entity. Metrics are measurements computed from data such as `Monthly Active Users`. Some of the metrics that measures used to determine performance against an objective are called KPIs or Key Performance Indicators, such as `User Retention`.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentitydatametrics.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json/properties/id">id</b> `required`
	 - Unique identifier that identifies this metrics instance.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json/properties/name">name</b> `required`
	 - Name that identifies this metrics instance uniquely.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json/properties/fullyQualifiedName">fullyQualifiedName</b>
	 - A unique name that identifies a metric in the format 'ServiceName.MetricName'.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json/properties/description">description</b>
	 - Description of metrics instance, what it is, and how to use it.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json/properties/href">href</b>
	 - Link to the resource corresponding to this entity.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json/properties/owner">owner</b>
	 - Owner of this metrics.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json/properties/service">service</b> `required`
	 - Link to service where this metrics is hosted in.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json/properties/usageSummary">usageSummary</b>
	 - Latest usage information for this database.
	 - &#36;ref: [../../type/usageDetails.json](#....typeusagedetails.json)
