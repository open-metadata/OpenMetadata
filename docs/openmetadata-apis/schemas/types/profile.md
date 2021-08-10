# Profile

This schema defines type used to capture profile of a user, team, or an organization.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypeprofile.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json/properties/images">images</b>
	 - &#36;ref: [#/definitions/imageList](#/definitions/imageList)


## Definitions
**_imageList_**

 - Links to list of images of varying resolutions/sizes.
 - Type: `object`
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json/definitions/imageList/properties/image">image</b>
		 - Type: `string`
		 - String format must be a "uri"
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json/definitions/imageList/properties/image24">image24</b>
		 - Type: `string`
		 - String format must be a "uri"
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json/definitions/imageList/properties/image32">image32</b>
		 - Type: `string`
		 - String format must be a "uri"
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json/definitions/imageList/properties/image48">image48</b>
		 - Type: `string`
		 - String format must be a "uri"
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json/definitions/imageList/properties/image72">image72</b>
		 - Type: `string`
		 - String format must be a "uri"
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json/definitions/imageList/properties/image192">image192</b>
		 - Type: `string`
		 - String format must be a "uri"
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/profile.json/definitions/imageList/properties/image512">image512</b>
		 - Type: `string`
		 - String format must be a "uri"



_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_ _Mon Aug 09 2021 19:12:30 GMT-0700 (Pacific Daylight Time)_