# Messaging Service

This schema defines the Messaging Service entity, such as Kafka and Pulsar.

**$id:**[**https://open-metadata.org/schema/entity/services/messagingService.json**](https://open-metadata.org/schema/entity/services/messagingService.json)

Type: `object`

## Properties
- **id** `required`
  - Unique identifier of this messaging service instance.
  - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
- **name** `required`
  - Name that identifies this messaging service.
  - Type: `string`
  - Length: between 1 and 64
- **serviceType** `required`
  - Type of messaging service such as Kafka or Pulsar...
  - $ref: [#/definitions/messagingServiceType](#messagingservicetype)
- **description**
  - Description of a messaging service instance.
  - Type: `string`
- **displayName**
  - Display Name that identifies this messaging service. It could be title or label from the source services.
  - Type: `string`
- **version**
  - Metadata version of the entity.
  - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
- **updatedAt**
  - Last update time corresponding to the new version of the entity.
  - $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
- **updatedBy**
  - User who made the update.
  - Type: `string`
- **brokers** `required`
  - Multiple bootstrap addresses for Kafka. Single proxy address for Pulsar.
  - $ref: [#/definitions/brokers](#brokers)
- **schemaRegistry**
  - Schema registry URL.
  - Type: `string`
  - String format must be a "uri"
- **ingestionSchedule**
  - Schedule for running metadata ingestion jobs.
  - $ref: [../../type/schedule.json](../types/schedule.md)
- **href**
  - Link to the resource corresponding to this messaging service.
  - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
- **changeDescription**
  - Change that lead to this version of the entity.
  - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)


## Type definitions in this schema

### messagingServiceType

- Type of messaging service - Kafka or Pulsar.
- Type: `string`
- The value is restricted to the following: 
  1. _"Kafka"_
  2. _"Pulsar"_

### brokers

- Multiple bootstrap addresses for Kafka. Single proxy address for Pulsar.
- Type: `array`
  - **Items**
  - Type: `string`


_This document was updated on: Monday, November 15, 2021_