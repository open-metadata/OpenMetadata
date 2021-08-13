# Type used for schedule with start time and repeat frequency

This schema defines the type used for schedule. Schedule has a start time and repeat frequency.

<b id="httpsopen-metadata.orgschematypeschedule.json">&#36;id: https://open-metadata.org/schema/type/schedule.json</b>

Type: `object`

## Properties
 - <b id="#https://open-metadata.org/schema/type/schedule.json/properties/startDate">startDate</b>
	 - Start date and time of the schedule.
	 - &#36;ref: [basic.json#/definitions/dateTime](#basic.jsondefinitionsdatetime)
 - <b id="#https://open-metadata.org/schema/type/schedule.json/properties/repeatFrequency">repeatFrequency</b>
	 - Repeat frequency in ISO 8601 duration format. Example - 'P23DT23H'
	 - &#36;ref: [basic.json#/definitions/duration](#basic.jsondefinitionsduration)
