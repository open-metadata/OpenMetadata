# Usage details of an entity

This schema defines the type used for capturing usage details of an entity.

**$id: https://open-metadata.org/schema/type/entityUsage.json**

Type: `object`

## Properties
 - **entity** `required`
   - Entity for which usage is returned.
   - $ref: [entityReference.json](entityreference.md)
 - **usage** `required`
   - List usage details per day.
   - Type: `array`
     - **Items**
     - $ref: [usageDetails.json](usagedetails.md)

_This document was updated on: Tuesday, October 12, 2021_