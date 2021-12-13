# TagBased

Describes an Access Control Rule to selectively grant access to Teams/Users to tagged entities.

**$id:**[**https://open-metadata.org/schema/entity/policies/accesscontrol/tagbased.json**](https://open-metadata.org/schema/entity/policies/accessControl/tagBased.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
- **tags** `required` 
  - Tags that are associated with the entities.
    - Type: `array`
      - **Items**
      - $ref: [../type/tagLabel.json](../types/taglabel.md)
- **allow** `required`
  - Teams and Users who are able to access the tagged entities.
  - Type: `array`
    - **Items**

_This document was updated on: Thursday, December 9, 2021_