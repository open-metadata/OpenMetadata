# Tag Label

This schema defines type used for labeling an entity or an entity field with a Tag.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypetaglabel.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json/properties/tagFQN">tagFQN</b>
	 - Type: `string`
	 - Length:  &le; 45
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json/properties/labelType">labelType</b>
	 - Type: `string`
	 - The value is restricted to the following: 
		 1. _"Manual"_
		 2. _"Propagated"_
		 3. _"Automated"_
		 4. _"Derived"_
	 - Default: _"Manual"_
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json/properties/state">state</b>
	 - Type: `string`
	 - The value is restricted to the following: 
		 1. _"Suggested"_
		 2. _"Confirmed"_
	 - Default: _"Confirmed"_
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json/properties/href">href</b>
	 - Link to the tag resource.
	 - &#36;ref: [basic.json#/definitions/href](#basic.jsondefinitionshref)

_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_ _Mon Aug 09 2021 19:12:30 GMT-0700 (Pacific Daylight Time)_