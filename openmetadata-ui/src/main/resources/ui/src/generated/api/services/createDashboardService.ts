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
 * Create Dashboard service entity request
 */
export interface CreateDashboardService {
  connection: DashboardConnection;
  /**
   * Description of dashboard service entity.
   */
  description?: string;
  /**
   * Name that identifies the this entity instance uniquely
   */
  name: string;
  /**
   * Owner of this dashboard service.
   */
  owner?: EntityReference;
  serviceType: DashboardServiceType;
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
   * Tableau Environment Name.
   */
  env?: string;
  /**
   * URL to the Looker instance.
   *
   * Host and Port of the Metabase instance.
   *
   * Dashboard URL for PowerBI service.
   *
   * URL for the Redash instance
   *
   * URL for the superset instance.
   *
   * Tableau Server.
   */
  hostPort?: string;
  /**
   * Password to connect to Looker.
   *
   * Password to connect to Metabase.
   *
   * Password for Superset.
   *
   * Password for Tableau.
   */
  password?: string;
  supportsMetadataExtraction?: boolean;
  /**
   * Service Type
   */
  type?: DashboardServiceType;
  /**
   * Username to connect to Looker. This user should have privileges to read all the metadata
   * in Looker.
   *
   * Username to connect to Metabase. This user should have privileges to read all the
   * metadata in Metabase.
   *
   * Username for Redash
   *
   * Username for Superset.
   *
   * Username for Tableau.
   */
  username?: string;
  /**
   * Database Service Name for creation of lineage
   *
   * Database Service Name to create lineage
   *
   * Database Service Name in order to add data lineage.
   */
  dbServiceName?: string;
  /**
   * client_id for PowerBI.
   */
  clientId?: string;
  /**
   * clientSecret for PowerBI.
   */
  clientSecret?: string;
  /**
   * Credentials for PowerBI.
   */
  credentials?: string;
  /**
   * Dashboard redirect URI for the PowerBI service.
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
   * Additional connection options that can be sent to service during the connection.
   */
  connectionOptions?: { [key: string]: any };
  /**
   * Authentication provider for the Superset service.
   */
  provider?: string;
  /**
   * Tableau API version.
   */
  apiVersion?: string;
  /**
   * Personal Access Token Name.
   */
  personalAccessTokenName?: string;
  /**
   * Personal Access Token Secret.
   */
  personalAccessTokenSecret?: string;
  /**
   * Tableau Site Name.
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
