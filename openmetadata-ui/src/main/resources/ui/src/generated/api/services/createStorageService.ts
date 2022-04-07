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
 * Create Storage service entity request
 */
export interface CreateStorageService {
  /**
   * Description of Storage entity.
   */
  description?: string;
  /**
   * Name that identifies the this entity instance uniquely
   */
  name: string;
  /**
   * Owner of this storage service.
   */
  owner?: EntityReference;
  serviceType?: StorageServiceType;
}

/**
 * Owner of this storage service.
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
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
   * `dashboardService`...
   */
  type: string;
}

/**
 * Type of storage service such as S3, GCS, HDFS...
 */
export enum StorageServiceType {
  Abfs = 'ABFS',
  Gcs = 'GCS',
  Hdfs = 'HDFS',
  S3 = 'S3',
}
