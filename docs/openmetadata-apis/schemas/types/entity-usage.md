# Entity Usage

This schema defines the type used for capturing usage details of an entity.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json)

Type: `object`

## Properties

* **entity** `required`
  * Entity for which usage is returned.
  * $ref: [entityReference.json](entity-usage.md#entityreference.json)
* **usage** `required`
  * List usage details per day.
  * Type: `array`
    * **Items**
    * $ref: [usageDetails.json](entity-usage.md#usagedetails.json)

