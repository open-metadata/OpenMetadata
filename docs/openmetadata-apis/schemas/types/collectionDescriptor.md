# Schema for collection descriptor

Type used for capturing the details of a collection.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypecollectiondescriptor.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json/properties/collection">collection</b>
	 - &#36;ref: [#/definitions/collectionInfo](#/definitions/collectionInfo)


## Definitions
**_collectionInfo_**

 - Collection Info.
 - Type: `object`
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json/definitions/collectionInfo/properties/name">name</b>
		 - Unique name that identifies a collection.
		 - Type: `string`
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json/definitions/collectionInfo/properties/documentation">documentation</b>
		 - Description of collection.
		 - Type: `string`
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json/definitions/collectionInfo/properties/href">href</b>
		 - URL of the API endpoint where given collections are available.
		 - Type: `string`
		 - String format must be a "uri"
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json/definitions/collectionInfo/properties/images">images</b>
		 - &#36;ref: [profile.json#/definitions/imageList](#profile.jsondefinitionsimagelist)



_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_ _Mon Aug 09 2021 19:12:30 GMT-0700 (Pacific Daylight Time)_