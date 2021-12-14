# Policy

This schema defines the Policy entity. A Policy defines lifecycle or access control that needs to be applied across different Data Entities.

**$id:** [**https://open-metadata.org/schema/entity/policies/policy.json**](https://open-metadata.org/schema/entity/policies/policy.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
- **id** `required` 
  - Unique identifier that identifies this Policy.
  - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
- **name** `required`
  - Name that identifies this Policy.
  - $ref: [#/definitions/policyName](#policyname)
- **fullyQualifiedName**
  - Name that uniquely identifies a Policy.
  - Type: `string`
  - Length: between 1 and 256
- **displayName**
  - Title for this Policy.
  - Type: `string`
- **description**
  - A short description of the Policy, comprehensible to regular users.
  - Type: `string`
- **owner**
  - Owner of this Policy.
  - $ref: [../../type/entityReference.json](../types/entityreference.md)
- **policyUrl**
  - Link to a well documented definition of this Policy.
  - Type: `string`
  - String format must be a "uri"
- **href**
  - Link to the resource corresponding to this entity.
  - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
- **policyType** `required`
  - $ref: [#/definitions/policyType](#policytype)
- **enabled**
  - Is the policy enabled.
  - Type: `boolean`
  - Default: _true_
- **version**
  - Metadata version of the Policy.
  - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
- **updatedAt**
  - Last update time corresponding to the new version of the Policy.
  - $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
- **updatedBy**
  - User who made the update.
  - Type: `string`
- **changeDescription**
  - Change that led to this version of the Policy.
  - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
- **rules**
  - $ref: [#/definitions/rules](#rules)


## Type definitions in this schema
### policyName

- Name that identifies this Policy.
- Type: `string`
- Length: between 1 and 128


### policyType

- This schema defines the type used for describing different types of policies.
- Type: `string`
- The value is restricted to the following: 
  1. _"AccessControl"_
  2. _"Lifecycle"_


### rules

- A set of rules associated with the Policy.
- Type: `array`
  - **Items**




_This document was updated on: Tuesday, December 14, 2021_