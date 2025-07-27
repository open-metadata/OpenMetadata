---
title: Create Topic API | OpenMetadata Topic API
description: Connect Createtopic to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/api/data/createtopic
---

# CreateTopicRequest

*Create a topic entity request*

## Properties

- **`name`**: Name that identifies this topic instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this topic.
- **`description`**: Description of the topic instance. What it has and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`service`**: Fully qualified name of the messaging service where this topic is hosted in. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`messageSchema`**: Refer to *[../../type/schema.json](#/../type/schema.json)*.
- **`partitions`** *(integer)*: Number of partitions into which the topic is divided. Minimum: `1`.
- **`cleanupPolicies`** *(array)*: Topic clean up policy. For Kafka - `cleanup.policy` configuration.
  - **Items**: Refer to *[../../entity/data/topic.json#/definitions/cleanupPolicy](#/../entity/data/topic.json#/definitions/cleanupPolicy)*.
- **`replicationFactor`** *(integer)*: Replication Factor in integer (more than 1).
- **`retentionTime`** *(number)*: Retention time in milliseconds. For Kafka - `retention.ms` configuration.
- **`maximumMessageSize`** *(integer)*: Maximum message size in bytes. For Kafka - `max.message.bytes` configuration.
- **`minimumInSyncReplicas`** *(integer)*: Minimum number replicas in sync to control durability. For Kafka - `min.insync.replicas` configuration.
- **`retentionSize`** *(number)*: Maximum size of a partition in bytes before old data is discarded. For Kafka - `retention.bytes` configuration. Default: `"-1"`.
- **`topicConfig`**: Contains key/value pair of topic configuration. Refer to *[../../entity/data/topic.json#/definitions/topicConfig](#/../entity/data/topic.json#/definitions/topicConfig)*.
- **`owners`**: Owners of this topic. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this topic. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of topic. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Topic belongs to. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
