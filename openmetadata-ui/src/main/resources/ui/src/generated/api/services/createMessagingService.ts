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
 * Create Messaging service entity request
 */
export interface CreateMessagingService {
  connection: MessagingConnection;
  /**
   * Description of messaging service entity.
   */
  description?: string;
  /**
   * Name that identifies the this entity instance uniquely
   */
  name: string;
  /**
   * Owner of this messaging service.
   */
  owner?: EntityReference;
  serviceType: MessagingServiceType;
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
