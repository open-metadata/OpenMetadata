# Usage details of an entity

This schema defines the type used for capturing usage details of an entity.

<b id="httpsopen-metadata.orgschematypeentityusage.json">&#36;id: https://open-metadata.org/schema/type/entityUsage.json</b>

Type: `object`

## Properties
 - <b id="#https://open-metadata.org/schema/type/entityUsage.json/properties/entity">entity</b> `required`
	 - Entity for which usage is returned.
	 - &#36;ref: [entityReference.json](#entityreference.json)
 - <b id="#https://open-metadata.org/schema/type/entityUsage.json/properties/usage">usage</b> `required`
	 - List usage details per day.
	 - Type: `array`
		 - **Items**
		 - &#36;ref: [usageDetails.json](#usagedetails.json)
