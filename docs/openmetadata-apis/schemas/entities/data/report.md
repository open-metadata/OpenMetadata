# Report

This schema defines Report entity.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentitydatareport.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json/properties/id">id</b> `required`
	 - Unique identifier that identifies this report.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json/properties/name">name</b> `required`
	 - Name that identifies the this report instance uniquely.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json/properties/fullyQualifiedName">fullyQualifiedName</b>
	 - Unique name that identifies a report in the format 'ServiceName.ReportName'.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json/properties/description">description</b>
	 - Description of this report instance.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json/properties/href">href</b>
	 - Link to the resource corresponding to this report.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json/properties/owner">owner</b>
	 - Owner of this pipeline.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json/properties/service">service</b> `required`
	 - Link to service where this report is hosted in.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json/properties/usageSummary">usageSummary</b>
	 - Latest usage information for this database.
	 - &#36;ref: [../../type/usageDetails.json](#....typeusagedetails.json)
