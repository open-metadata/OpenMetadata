/**
 * This schema defines the Topic entity. A topic is a feed into which message are published
 * to by publishers and read from by consumers in a messaging service.
 */
export interface Topic {
  /**
   * Topic clean up policies. For Kafka - `cleanup.policy` configuration.
   */
  cleanupPolicies?: CleanupPolicy[];
  /**
   * Description of the topic instance.
   */
  description?: string;
  /**
   * Followers of this table.
   */
  followers?: EntityReference[];
  /**
   * Name that uniquely identifies a topic in the format 'messagingServiceName.topicName'.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href?: string;
  /**
   * Unique identifier that identifies this topic instance.
   */
  id: string;
  /**
   * Maximum message size in bytes. For Kafka - `max.message.bytes` configuration.
   */
  maximumMessageSize?: number;
  /**
   * Minimum number replicas in sync to control durability. For Kafka - `min.insync.replicas`
   * configuration.
   */
  minimumInSyncReplicas?: number;
  /**
   * Name that identifies the topic.
   */
  name: string;
  /**
   * Owner of this topic.
   */
  owner?: EntityReference;
  /**
   * Number of partitions into which the topic is divided.
   */
  partitions: number;
  /**
   * Maximum size of a partition in bytes before old data is discarded. For Kafka -
   * `retention.bytes` configuration.
   */
  retentionSize?: number;
  /**
   * Retention time in milliseconds. For Kafka - `retention.ms` configuration.
   */
  retentionTime?: number;
  /**
   * Schema used for message serialization. Optional as some topics may not have associated
   * schemas.
   */
  schemaText?: string;
  /**
   * Schema used for message serialization.
   */
  schemaType?: SchemaType;
  /**
   * Link to the messaging cluster/service where this topic is hosted in.
   */
  service: EntityReference;
  /**
   * Tags for this table.
   */
  tags?: TagLabel[];
}

/**
 * Topic clean up policy. For Kafka - `cleanup.policy` configuration.
 */
export enum CleanupPolicy {
  Compact = 'compact',
  Delete = 'delete',
}

/**
 * Followers of this table.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owner of this topic.
 *
 * Link to the messaging cluster/service where this topic is hosted in.
 */
export interface EntityReference {
  /**
   * Optional description of entity.
   */
  description?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * Name of the entity instance. For entities such as tables, databases where the name is not
   * unique, fullyQualifiedName is returned in this field.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`,
   * `bigquery`, `snowflake`...
   */
  type: string;
}

/**
 * Schema used for message serialization.
 *
 * Schema type used for the message.
 */
export enum SchemaType {
  Avro = 'Avro',
  JSON = 'JSON',
  Other = 'Other',
  Protobuf = 'Protobuf',
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
  /**
   * Link to the tag resource.
   */
  href?: string;
  /**
   * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
   * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
   * relationship (see TagCategory.json for more details). 'Propagated` indicates a tag label
   * was propagated from upstream based on lineage. 'Automated' is used when a tool was used
   * to determine the tag label.
   */
  labelType?: LabelType;
  /**
   * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
   * entity must confirm the suggested labels before it is marked as 'Confirmed'.
   */
  state?: State;
  tagFQN?: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see TagCategory.json for more details). 'Propagated` indicates a tag label
 * was propagated from upstream based on lineage. 'Automated' is used when a tool was used
 * to determine the tag label.
 */
export enum LabelType {
  Automated = 'Automated',
  Derived = 'Derived',
  Manual = 'Manual',
  Propagated = 'Propagated',
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
  Confirmed = 'Confirmed',
  Suggested = 'Suggested',
}
