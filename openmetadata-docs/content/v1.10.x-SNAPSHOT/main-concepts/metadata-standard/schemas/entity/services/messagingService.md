---
title: messagingService
slug: /main-concepts/metadata-standard/schemas/entity/services/messagingservice
---

# Messaging Service

*This schema defines the Messaging Service entity, such as Kafka and Pulsar.*

## Properties

- **`id`**: Unique identifier of this messaging service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this messaging service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`serviceType`**: Type of messaging service such as Kafka or Pulsar... Refer to *#/definitions/messagingServiceType*.
- **`description`**: Description of a messaging service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`displayName`** *(string)*: Display Name that identifies this messaging service. It could be title or label from the source services.
- **`connection`**: Refer to *#/definitions/messagingConnection*.
- **`pipelines`**: References to pipelines deployed for this messaging service to extract topic configs and schemas. Refer to *../../type/entityReferenceList.json*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this Message Service. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`owners`**: Owners of this messaging service. Refer to *../../type/entityReferenceList.json*.
- **`href`**: Link to the resource corresponding to this messaging service. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`domains`**: Domains the Messaging service belongs to. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.
## Definitions

- **`messagingServiceType`** *(string)*: Type of messaging service - Kafka or Pulsar. Must be one of: `['Kafka', 'Redpanda', 'Kinesis', 'CustomMessaging']`.
- **`brokers`** *(array)*: Multiple bootstrap addresses for Kafka. Single proxy address for Pulsar. Default: `None`.
  - **Items** *(string)*
- **`messagingConnection`** *(object)*: Dashboard Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
