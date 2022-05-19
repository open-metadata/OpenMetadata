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
 * This schema defines the Metadata Service entity, such as Amundsen, Atlas etc.
 */
export interface MetadataService {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  connection: MetadataConnection;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of a database service instance.
   */
  description?: string;
  /**
   * Display Name that identifies this database service.
   */
  displayName?: string;
  /**
   * FullyQualifiedName same as `name`.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the resource corresponding to this database service.
   */
  href?: string;
  /**
   * Unique identifier of this database service instance.
   */
  id: string;
  /**
   * Name that identifies this database service.
   */
  name: string;
  /**
   * Owner of this database service.
   */
  owner?: EntityReference;
  /**
   * References to pipelines deployed for this database service to extract metadata, usage,
   * lineage etc..
   */
  pipelines?: EntityReference[];
  /**
   * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
   */
  serviceType: MetadataServiceType;
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
 * Metadata Service Connection.
 */
export interface MetadataConnection {
  config?: Connection;
}

/**
 * Amundsen Connection Config
 *
 * Metadata to ElasticSearch Connection Config
 *
 * OpenMetadata Connection Config
 */
export interface Connection {
  /**
   * Enable encryption for the Amundsen Neo4j Connection.
   */
  encrypted?: boolean;
  /**
   * Host and port of the Amundsen Neo4j Connection.
   *
   * OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
   */
  hostPort?: string;
  /**
   * Maximum connection lifetime for the Amundsen Neo4j Connection.
   */
  maxConnectionLifeTime?: number;
  /**
   * Model Class for the Amundsen Neo4j Connection.
   */
  modelClass?: string;
  /**
   * password to connect to the Amundsen Neo4j Connection.
   */
  password?: string;
  supportsMetadataExtraction?: boolean;
  /**
   * Service Type
   */
  type?: MetadataServiceType;
  /**
   * username to connect to the Amundsen Neo4j Connection.
   */
  username?: string;
  /**
   * Enable SSL validation for the Amundsen Neo4j Connection.
   */
  validateSSL?: boolean;
  /**
   * Include Dashboards for Indexing
   */
  includeDashboards?: boolean;
  /**
   * Include Database Services for Indexing
   */
  includeDatabaseServices?: boolean;
  /**
   * Include Glossary Terms for Indexing
   */
  includeGlossaryTerms?: boolean;
  /**
   * Include Messaging Services for Indexing
   */
  includeMessagingServices?: boolean;
  /**
   * Include Pipelines for Indexing
   */
  includePipelines?: boolean;
  /**
   * Include Pipeline Services for Indexing
   */
  includePipelineServices?: boolean;
  /**
   * Include Tags for Policy
   */
  includePolicy?: boolean;
  /**
   * Include Tables for Indexing
   */
  includeTables?: boolean;
  /**
   * Include Tags for Indexing
   */
  includeTags?: boolean;
  /**
   * Include Teams for Indexing
   */
  includeTeams?: boolean;
  /**
   * Include Topics for Indexing
   */
  includeTopics?: boolean;
  /**
   * Include Users for Indexing
   */
  includeUsers?: boolean;
  /**
   * Limit the number of records for Indexing.
   */
  limitRecords?: number;
  /**
   * OpenMetadata server API version to use.
   */
  apiVersion?: string;
  /**
   * OpenMetadata Server Authentication Provider. Make sure configure same auth providers as
   * the one configured on OpenMetadata server.
   */
  authProvider?: AuthProvider;
  /**
   * Validate Openmetadata Server & Client Version.
   */
  enableVersionValidation?: boolean;
  /**
   * OpenMetadata Client security configuration.
   */
  securityConfig?: ClientConfig;
}

/**
 * OpenMetadata Server Authentication Provider. Make sure configure same auth providers as
 * the one configured on OpenMetadata server.
 */
export enum AuthProvider {
  Auth0 = 'auth0',
  Azure = 'azure',
  CustomOidc = 'custom-oidc',
  Google = 'google',
  NoAuth = 'no-auth',
  Okta = 'okta',
  Openmetadata = 'openmetadata',
}

/**
 * OpenMetadata Client security configuration.
 *
 * Google SSO client security configs.
 *
 * Okta SSO client security configs.
 *
 * Auth0 SSO client security configs.
 *
 * Azure SSO Client security config to connect to OpenMetadata.
 *
 * Custom OIDC SSO client security configs.
 *
 * openMetadataJWTClientConfig security configs.
 */
export interface ClientConfig {
  /**
   * Google SSO audience URL
   */
  audience?: string;
  /**
   * Google SSO client secret key path or contents.
   *
   * Auth0 Client Secret Key.
   *
   * Custom OIDC Client Secret Key.
   */
  secretKey?: string;
  /**
   * Okta Client ID.
   *
   * Auth0 Client ID.
   *
   * Azure Client ID.
   *
   * Custom OIDC Client ID.
   */
  clientId?: string;
  /**
   * Okta Service account Email.
   */
  email?: string;
  /**
   * Okta org url.
   */
  orgURL?: string;
  /**
   * Okta Private Key.
   */
  privateKey?: string;
  /**
   * Okta client scopes.
   *
   * Azure Client ID.
   */
  scopes?: string[];
  /**
   * Auth0 Domain.
   */
  domain?: string;
  /**
   * Azure SSO Authority
   */
  authority?: string;
  /**
   * Azure SSO client secret key
   */
  clientSecret?: string;
  /**
   * Custom OIDC token endpoint.
   */
  tokenEndpoint?: string;
  /**
   * OpenMetadata generated JWT token.
   */
  jwtToken?: string;
}

/**
 * Service Type
 *
 * Amundsen service type
 *
 * Metadata to Elastic Search type
 *
 * OpenMetadata service type
 *
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 *
 * Type of database service such as Amundsen, Atlas...
 */
export enum MetadataServiceType {
  Amundsen = 'Amundsen',
  MetadataES = 'MetadataES',
  OpenMetadata = 'OpenMetadata',
}

/**
 * Owner of this database service.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * References to pipelines deployed for this database service to extract metadata, usage,
 * lineage etc..
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
