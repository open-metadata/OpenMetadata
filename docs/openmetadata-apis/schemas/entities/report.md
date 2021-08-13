# Report

This schema defines the Report entity. Reports are static information computed from data periodically that includes data in text, table, and in visual form.

<b id="httpsopen-metadata.orgschemaentitydatareport.json">&#36;id: https://open-metadata.org/schema/entity/data/report.json</b>

Type: `object`

## Properties
 - <b id="#https://open-metadata.org/schema/entity/data/report.json/properties/id">id</b> `required`
	 - Unique identifier that identifies this report.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://open-metadata.org/schema/entity/data/report.json/properties/name">name</b> `required`
	 - Name that identifies the this report instance uniquely.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://open-metadata.org/schema/entity/data/report.json/properties/fullyQualifiedName">fullyQualifiedName</b>
	 - A unique name that identifies a report in the format 'ServiceName.ReportName'.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://open-metadata.org/schema/entity/data/report.json/properties/description">description</b>
	 - Description of this report instance.
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/entity/data/report.json/properties/href">href</b>
	 - Link to the resource corresponding to this report.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://open-metadata.org/schema/entity/data/report.json/properties/owner">owner</b>
	 - Owner of this pipeline.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://open-metadata.org/schema/entity/data/report.json/properties/service">service</b> `required`
	 - Link to service where this report is hosted in.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://open-metadata.org/schema/entity/data/report.json/properties/usageSummary">usageSummary</b>
	 - Latest usage information for this database.
	 - &#36;ref: [../../type/usageDetails.json](#....typeusagedetails.json)
