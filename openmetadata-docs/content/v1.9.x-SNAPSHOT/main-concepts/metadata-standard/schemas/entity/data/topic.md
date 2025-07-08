---
title: Topic Schema | OpenMetadata Topic Schema and Definitions
slug: /main-concepts/metadata-standard/schemas/entity/data/topic
---

# Topic

*A `Topic` is a feed or an event stream in a `Messaging Service` into which publishers publish messages and consumed by consumers.*

## Properties

- **`id`**: Unique identifier that identifies this topic instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies the topic. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: Name that uniquely identifies a topic in the format 'messagingServiceName.topicName'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this topic. It could be title or label from the source services.
- **`description`**: Description of the topic instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`service`**: Link to the messaging cluster/service where this topic is hosted in. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`serviceType`**: Service type where this topic is hosted in. Refer to *[../services/messagingService.json#/definitions/messagingServiceType](#/services/messagingService.json#/definitions/messagingServiceType)*.
- **`messageSchema`**: Refer to *[../../type/schema.json](#/../type/schema.json)*.
- **`partitions`** *(integer)*: Number of partitions into which the topic is divided. Minimum: `1`.
- **`cleanupPolicies`** *(array)*: Topic clean up policies. For Kafka - `cleanup.policy` configuration.
  - **Items**: Refer to *[#/definitions/cleanupPolicy](#definitions/cleanupPolicy)*.
- **`retentionTime`** *(number)*: Retention time in milliseconds. For Kafka - `retention.ms` configuration.
- **`replicationFactor`** *(integer)*: Replication Factor in integer (more than 1).
- **`maximumMessageSize`** *(integer)*: Maximum message size in bytes. For Kafka - `max.message.bytes` configuration.
- **`minimumInSyncReplicas`** *(integer)*: Minimum number replicas in sync to control durability. For Kafka - `min.insync.replicas` configuration.
- **`retentionSize`** *(number)*: Maximum size of a partition in bytes before old data is discarded. For Kafka - `retention.bytes` configuration. Default: `"-1"`.
- **`topicConfig`**: Contains key/value pair of topic configuration. Refer to *[#/definitions/topicConfig](#definitions/topicConfig)*.
- **`sampleData`**: Sample data for a topic. Refer to *[#/definitions/topicSampleData](#definitions/topicSampleData)*. Default: `null`.
- **`owners`**: Owners of this topic. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`followers`**: Followers of this table. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this table. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of topic. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`**: Domain the Topic belongs to. When not set, the Topic inherits the domain from the messaging service it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`votes`**: Votes on the entity. Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`certification`**: Refer to *[../../type/assetCertification.json](#/../type/assetCertification.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.
## Definitions

- **`cleanupPolicy`**: Topic clean up policy. For Kafka - `cleanup.policy` configuration. Must be one of: `["delete", "compact"]`.
- **`topicConfig`** *(object)*: Contains key/value pair of topic configuration.
- **`topicSampleData`** *(object)*: This schema defines the type to capture sample data for a topic. Cannot contain additional properties.
  - **`messages`** *(array)*: List of local sample messages for a topic.
    - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
