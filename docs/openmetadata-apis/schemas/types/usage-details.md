# Type used to return usage details of an entity

This schema defines the type for usage details. Daily, weekly, and monthly aggregation of usage is computed along with the percentile rank based on the usage for a given day.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypeusagedetails.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json/properties/dailyStats">dailyStats</b> `required`
	 - Daily usage stats of a data asset on the start date.
	 - &#36;ref: [#/definitions/usageStats](#/definitions/usageStats)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json/properties/weeklyStats">weeklyStats</b>
	 - Weekly (last 7 days) rolling usage stats of a data asset on the start date.
	 - &#36;ref: [#/definitions/usageStats](#/definitions/usageStats)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json/properties/monthlyStats">monthlyStats</b>
	 - Monthly (last 30 days) rolling usage stats of a data asset on the start date.
	 - &#36;ref: [#/definitions/usageStats](#/definitions/usageStats)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json/properties/date">date</b> `required`
	 - Date in UTC.
	 - &#36;ref: [basic.json#/definitions/date](#basic.jsondefinitionsdate)


## Types definitions in this schema
**usageStats**

 - Type used to return usage statistics
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json/definitions/usageStats/properties/count">count</b> `required`
		 - Usage count of a data asset on the start date.
		 - Type: `integer`
		 - Range:  &ge; 0
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json/definitions/usageStats/properties/percentileRank">percentileRank</b>
		 - Optional daily percentile rank data asset use when relevant.
		 - Type: `number`
		 - Range: between 0 and 100


