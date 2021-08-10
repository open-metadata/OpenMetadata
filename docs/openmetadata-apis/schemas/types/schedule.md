# Type used for schedule with start time and repeat frequency

This schema defines the type used for schedule with start time and repeat frequency.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypeschedule.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json/properties/startDate">startDate</b>
	 - Start date and time of the schedule.
	 - &#36;ref: [basic.json#/definitions/dateTime](#basic.jsondefinitionsdatetime)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json/properties/repeatFrequency">repeatFrequency</b>
	 - Repeat frequency in ISO 8601 duration format. Example - 'P23DT23H'
	 - &#36;ref: [basic.json#/definitions/duration](#basic.jsondefinitionsduration)
