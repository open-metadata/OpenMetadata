---
title: Messaging Service | `brandName` Messaging Service
description: Represent messaging service connection configurations and ingestion support for Kafka, Pulsar, etc.
slug: /main-concepts/metadata-standard/schemas/entity/services/messagingservice
---

# Messaging Service

*This schema defines the Messaging Service entity, such as Kafka and Pulsar.*

## Properties

- **`id`**: Unique identifier of this messaging service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this messaging service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`serviceType`**: Type of messaging service such as Kafka or Pulsar... Refer to *[#/definitions/messagingServiceType](#definitions/messagingServiceType)*.
- **`description`**: Description of a messaging service instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`displayName`** *(string)*: Display Name that identifies this messaging service. It could be title or label from the source services.
- **`connection`**: Refer to *[#/definitions/messagingConnection](#definitions/messagingConnection)*.
- **`pipelines`**: References to pipelines deployed for this messaging service to extract topic configs and schemas. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this Message Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`owners`**: Owners of this messaging service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`href`**: Link to the resource corresponding to this messaging service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`domain`**: Domain the Messaging service belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`messagingServiceType`** *(string)*: Type of messaging service - Kafka or Pulsar. Must be one of: `["Kafka", "Redpanda", "Kinesis", "CustomMessaging"]`.
- **`brokers`** *(array)*: Multiple bootstrap addresses for Kafka. Single proxy address for Pulsar. Default: `null`.
  - **Items** *(string)*
- **`messagingConnection`** *(object)*: Dashboard Connection. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[./connections/messaging/kafkaConnection.json](#connections/messaging/kafkaConnection.json)*.
      - : Refer to *[./connections/messaging/redpandaConnection.json](#connections/messaging/redpandaConnection.json)*.
      - : Refer to *[./connections/messaging/kinesisConnection.json](#connections/messaging/kinesisConnection.json)*.
      - : Refer to *[connections/messaging/customMessagingConnection.json](#nnections/messaging/customMessagingConnection.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
