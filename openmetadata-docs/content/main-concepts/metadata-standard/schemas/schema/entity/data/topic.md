---
title: topic
slug: /main-concepts/metadata-standard/schemas/schema/entity/data
---

# Topic

*This schema defines the Topic entity. A topic is a feed into which message are published to by publishers and read from by consumers in a messaging service.*

## Properties

- **`id`**: Unique identifier that identifies this topic instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies the topic. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Name that uniquely identifies a topic in the format 'messagingServiceName.topicName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this topic. It could be title or label from the source services.
- **`description`**: Description of the topic instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`service`**: Link to the messaging cluster/service where this topic is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this topic is hosted in. Refer to *../services/messagingService.json#/definitions/messagingServiceType*.
- **`schemaText`** *(string)*: Schema used for message serialization. Optional as some topics may not have associated schemas.
- **`schemaType`**: Schema used for message serialization. Refer to *#/definitions/schemaType*.
- **`partitions`** *(integer)*: Number of partitions into which the topic is divided. Minimum: `1`.
- **`cleanupPolicies`** *(array)*: Topic clean up policies. For Kafka - `cleanup.policy` configuration.
  - **Items**: Refer to *#/definitions/cleanupPolicy*.
- **`retentionTime`** *(number)*: Retention time in milliseconds. For Kafka - `retention.ms` configuration.
- **`replicationFactor`** *(integer)*: Replication Factor in integer (more than 1).
- **`maximumMessageSize`** *(integer)*: Maximum message size in bytes. For Kafka - `max.message.bytes` configuration.
- **`minimumInSyncReplicas`** *(integer)*: Minimum number replicas in sync to control durability. For Kafka - `min.insync.replicas` configuration.
- **`retentionSize`** *(number)*: Maximum size of a partition in bytes before old data is discarded. For Kafka - `retention.bytes` configuration. Default: `-1`.
- **`topicConfig`**: Contains key/value pair of topic configuration. Refer to *#/definitions/topicConfig*.
- **`sampleData`**: Sample data for a topic. Refer to *#/definitions/topicSampleData*. Default: `None`.
- **`owner`**: Owner of this topic. Refer to *../../type/entityReference.json*.
- **`followers`**: Followers of this table. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`tags`** *(array)*: Tags for this table. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`schemaType`**: Schema type used for the message. Must be one of: `['Avro', 'Protobuf', 'JSON', 'Other']`.
- **`cleanupPolicy`**: Topic clean up policy. For Kafka - `cleanup.policy` configuration. Must be one of: `['delete', 'compact']`.
- **`topicConfig`** *(object)*: Contains key/value pair of topic configuration.
- **`topicSampleData`** *(object)*: This schema defines the type to capture sample data for a topic. Cannot contain additional properties.
  - **`messages`** *(array)*: List of local sample messages for a topic.
    - **Items** *(string)*


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
