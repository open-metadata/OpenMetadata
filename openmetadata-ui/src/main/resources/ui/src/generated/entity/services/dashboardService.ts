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
 * This schema defines the Dashboard Service entity, such as Looker and Superset.
 */
export interface DashboardService {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  connection: DashboardConnection;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of a dashboard service instance.
   */
  description?: string;
  /**
   * Display Name that identifies this dashboard service.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this dashboard service.
   */
  href?: string;
  /**
   * Unique identifier of this dashboard service instance.
   */
  id: string;
  /**
   * Name that identifies this dashboard service.
   */
  name: string;
  /**
   * Owner of this dashboard service.
   */
  owner?: EntityReference;
  /**
   * References to pipelines deployed for this dashboard service.
   */
  pipelines?: EntityReference[];
  /**
   * Type of dashboard service such as Looker or Superset...
   */
  serviceType: DashboardServiceType;
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
export interface DashboardConnection {
  config?: Connection;
}

/**
 * Looker Connection Config
 *
 * Metabase Connection Config
 *
 * PowerBI Connection Config
 *
 * Redash Connection Config
 *
 * Superset Connection Config
 *
 * Tableau Connection Config
 */
export interface Connection {
  /**
   * Looker Environment
   *
   * Tableau Environment Name
   */
  env?: string;
  /**
   * URL to Looker instance.
   *
   * Host and Port of Metabase instance.
   *
   * URL for the superset instance
   *
   * Tableau Server
   */
  hostPort?: string;
  /**
   * password to connect  to the Looker.
   *
   * password to connect  to the Metabase.
   *
   * password for the Superset
   *
   * password for the Tableau
   */
  password?: string;
  supportsMetadataExtraction?: boolean;
  /**
   * Service Type
   */
  type?: DashboardServiceType;
  /**
   * username to connect  to the Looker. This user should have privileges to read all the
   * metadata in Looker.
   *
   * username to connect  to the Metabase. This user should have privileges to read all the
   * metadata in Metabase.
   *
   * username for the Redash
   *
   * username for the Superset
   *
   * username for the Tableau
   */
  username?: string;
  /**
   * Database Service Name for creation of lineage
   */
  dbServiceName?: string;
  /**
   * client_id for the PowerBI.
   */
  clientId?: string;
  /**
   * clientSecret for the PowerBI.
   */
  clientSecret?: string;
  /**
   * Credentials for the PowerBI.
   */
  credentials?: string;
  /**
   * Dashboard URL for the power BI.
   */
  dashboardURL?: string;
  /**
   * Dashboard redirect URI for the PowerBI.
   */
  redirectURI?: string;
  /**
   * PowerBI secrets.
   */
  scope?: string[];
  /**
   * API key of the redash instance to access.
   */
  apiKey?: string;
  /**
   * URL for the redash instance
   */
  redashURL?: string;
  /**
   * Additional connection options that can be sent to service during the connection.
   */
  connectionOptions?: { [key: string]: any };
  /**
   * Database Service to create lineage
   */
  dbServiceConnection?: string;
  /**
   * authenticaiton provider for the Superset
   */
  provider?: string;
  /**
   * Tableau API version
   */
  apiVersion?: string;
  /**
   * Personal Access Token Name
   */
  personalAccessTokenName?: string;
  /**
   * Personal Access Token Secret
   */
  personalAccessTokenSecret?: string;
  /**
   * Tableau Site Name
   */
  siteName?: string;
}

/**
 * Service Type
 *
 * Looker service type
 *
 * Metabase service type
 *
 * PowerBI service type
 *
 * Redash service type
 *
 * Superset service type
 *
 * Tableau service type
 *
 * Type of dashboard service such as Looker or Superset...
 *
 * Type of Dashboard service - Superset, Looker, Redash or Tableau.
 */
export enum DashboardServiceType {
  Looker = 'Looker',
  Metabase = 'Metabase',
  PowerBI = 'PowerBI',
  Redash = 'Redash',
  Superset = 'Superset',
  Tableau = 'Tableau',
}

/**
 * Owner of this dashboard service.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * References to pipelines deployed for this dashboard service.
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
