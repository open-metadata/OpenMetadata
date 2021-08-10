# Tag Category

This schema defines the Tag Category entity. A Tag Category has one more children tags called Primary Tags. Primary Tags can have children Tags called Secondary Tags. Only two levels of tags are supported currently.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentitytagstagcategory.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json</b>

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json/properties/name">name</b> `required`
	 - &#36;ref: [#/definitions/tagName](#/definitions/tagName)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json/properties/description">description</b> `required`
	 - Description of the tag category.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json/properties/categoryType">categoryType</b> `required`
	 - &#36;ref: [#/definitions/tagCategoryType](#/definitions/tagCategoryType)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json/properties/href">href</b>
	 - Link to the resource corresponding to the tag category.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json/properties/usageCount">usageCount</b>
	 - Count of how many times the tags from this tag category are used.
	 - Type: `integer`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json/properties/children">children</b>
	 - Tags under this category.
	 - Type: `array`
		 - **Items**
		 - &#36;ref: [#/definitions/tag](#/definitions/tag)


## Types defined in this schema
**tagName**

 - Name of the tag.
 - Type: `string`
 - Length: between 2 and 25


**tagCategoryType**

 - Type of tag category.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"Descriptive"_
	 2. _"Classification"_


**tag**



