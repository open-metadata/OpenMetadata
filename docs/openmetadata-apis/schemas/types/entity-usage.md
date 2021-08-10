# Usage details of an entity

This schema defines type used for capturing usage details of an entity.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypeentityusage.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json/properties/entity">entity</b> `required`
	 - Entity for which usage is returned.
	 - &#36;ref: [entityReference.json](#entityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json/properties/usage">usage</b> `required`
	 - List usage details per day.
	 - Type: `array`
		 - **_Items_**
		 - &#36;ref: [usageDetails.json](#usagedetails.json)
