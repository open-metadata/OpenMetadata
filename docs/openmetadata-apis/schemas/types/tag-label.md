# Tag Label

This schema defines the type used for labeling an entity with a Tag.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/tagLabel.json)

Type: `object`

## Properties

* **tagFQN**
  * Type: `string`
  * Length:  ≤ 45
* **labelType**
  * Type: `string`
  * The value is restricted to the following: 
    1. _"Manual"_
    2. _"Propagated"_
    3. _"Automated"_
    4. _"Derived"_
  * Default: _"Manual"_
* **state**
  * Type: `string`
  * The value is restricted to the following: 
    1. _"Suggested"_
    2. _"Confirmed"_
  * Default: _"Confirmed"_
* **href**
  * Link to the tag resource.
  * $ref: [basic.json\#/definitions/href](tag-label.md#basic.jsondefinitionshref)

