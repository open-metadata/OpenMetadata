/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/**
 * This schema defines the Messaging Service entity, such as Kafka and Pulsar.
 */
export interface MessagingService {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  connection: MessagingConnection;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of a messaging service instance.
   */
  description?: string;
  /**
   * Display Name that identifies this messaging service. It could be title or label from the
   * source services.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this messaging service.
   */
  href?: string;
  /**
   * Unique identifier of this messaging service instance.
   */
  id: string;
  /**
   * Name that identifies this messaging service.
   */
  name: string;
  /**
   * Owner of this messaging service.
   */
  owner?: EntityReference;
  /**
   * References to pipelines deployed for this messaging service to extract topic configs and
   * schemas.
   */
  pipelines?: EntityReference[];
  /**
   * Type of messaging service such as Kafka or Pulsar...
   */
  serviceType: MessagingServiceType;
  /**
   * Last update time corresponding to the new version of the entity in Unix epoch time
   * milliseconds.
   */
  updatedAt?: number;
  /**
   * User who made the update.
   */
  updatedBy?: string;
  /**
   * Metadata version of the entity.
   */
  version?: number;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
  /**
   * Names of fields added during the version changes.
   */
  fieldsAdded?: FieldChange[];
  /**
   * Fields deleted during the version changes with old value before deleted.
   */
  fieldsDeleted?: FieldChange[];
  /**
   * Fields modified during the version changes with old and new values.
   */
  fieldsUpdated?: FieldChange[];
  /**
   * When a change did not result in change, this could be same as the current version.
   */
  previousVersion?: number;
}

export interface FieldChange {
  /**
   * Name of the entity field that changed.
   */
  name?: string;
  /**
   * New value of the field. Note that this is a JSON string and use the corresponding field
   * type to deserialize it.
   */
  newValue?: any;
  /**
   * Previous value of the field. Note that this is a JSON string and use the corresponding
   * field type to deserialize it.
   */
  oldValue?: any;
}

/**
 * Dashboard Connection.
 */
export interface MessagingConnection {
  config?: Connection;
}

/**
 * Kafka Connection Config
 *
 * Pulsar Connection Config
 */
export interface Connection {
  /**
   * Kafka bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092
   */
  bootstrapServers?: string;
  /**
   * Confluent Kafka Schema Registry URL.
   */
  schemaRegistryURL?: string;
  /**
   * Supported Metadata Extraction Pipelines.
   */
  supportedPipelineTypes?: SupportedPipelineTypes;
  /**
   * Service Type
   */
  type?: MessagingServiceType;
}

/**
 * Supported Metadata Extraction Pipelines.
 */
export enum SupportedPipelineTypes {
  Metadata = 'Metadata',
}

/**
 * Service Type
 *
 * Kafka service type
 *
 * Pulsar service type
 *
 * Type of messaging service such as Kafka or Pulsar...
 *
 * Type of messaging service - Kafka or Pulsar.
 */
export enum MessagingServiceType {
  Kafka = 'Kafka',
  Pulsar = 'Pulsar',
}

/**
 * Owner of this messaging service.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * References to pipelines deployed for this messaging service to extract topic configs and
 * schemas.
 */
export interface EntityReference {
  /**
   * If true the entity referred to has been soft-deleted.
   */
  deleted?: boolean;
  /**
   * Optional description of entity.
   */
  description?: string;
  /**
   * Display Name that identifies this entity.
   */
  displayName?: string;
  /**
   * Fully qualified name of the entity instance. For entities such as tables, databases
   * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
   * such as `user` and `team` this will be same as the `name` field.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * Name of the entity instance.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
   * `dashboardService`...
   */
  type: string;
}
