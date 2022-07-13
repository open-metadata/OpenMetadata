---
title: createTopic
slug: /main-concepts/metadata-standard/schemas/schema/api/data
---

# CreateTopicRequest

*Create a topic entity request*

## Properties

- **`name`**: Name that identifies this topic instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this topic.
- **`description`**: Description of the topic instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`service`**: Link to the messaging service where this topic is hosted in. Refer to *../../type/entityReference.json*.
- **`schemaText`** *(string)*: Schema used for message serialization. Optional as some topics may not have associated schemas.
- **`schemaType`**: Schema used for message serialization. Refer to *../../entity/data/topic.json#/definitions/schemaType*.
- **`partitions`** *(integer)*: Number of partitions into which the topic is divided. Minimum: `1`.
- **`cleanupPolicies`** *(array)*: Topic clean up policy. For Kafka - `cleanup.policy` configuration.
  - **Items**: Refer to *../../entity/data/topic.json#/definitions/cleanupPolicy*.
- **`replicationFactor`** *(integer)*: Replication Factor in integer (more than 1).
- **`retentionTime`** *(number)*: Retention time in milliseconds. For Kafka - `retention.ms` configuration.
- **`maximumMessageSize`** *(integer)*: Maximum message size in bytes. For Kafka - `max.message.bytes` configuration.
- **`minimumInSyncReplicas`** *(integer)*: Minimum number replicas in sync to control durability. For Kafka - `min.insync.replicas` configuration.
- **`retentionSize`** *(number)*: Maximum size of a partition in bytes before old data is discarded. For Kafka - `retention.bytes` configuration. Default: `-1`.
- **`topicConfig`**: Contains key/value pair of topic configuration. Refer to *../../entity/data/topic.json#/definitions/topicConfig*.
- **`owner`**: Owner of this topic. Refer to *../../type/entityReference.json*.
- **`tags`** *(array)*: Tags for this topic. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
