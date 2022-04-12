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
 * Create Policy Entity Request
 */
export interface CreatePolicy {
  /**
   * A short description of the Policy, comprehensible to regular users.
   */
  description?: string;
  /**
   * Title for this Policy.
   */
  displayName?: string;
  /**
   * Is the policy enabled.
   */
  enabled?: boolean;
  /**
   * UUID of Location where this policy is applied
   */
  location?: string;
  /**
   * Name that identifies this Policy.
   */
  name: string;
  /**
   * Owner of this Policy.
   */
  owner?: EntityReference;
  policyType: PolicyType;
  /**
   * Link to a well documented definition of this Policy.
   */
  policyUrl?: string;
  rules?: Rule[];
}

/**
 * Owner of this Policy.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Followers of this location.
 *
 * Owner of this location.
 *
 * Link to the database cluster/service where this database is hosted in.
 *
 * Owner of this storage service.
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

/**
 * This schema defines the type used for describing different types of policies.
 */
export enum PolicyType {
  AccessControl = 'AccessControl',
  Lifecycle = 'Lifecycle',
}

/**
 * A set of rules associated with the Policy.
 *
 * Describes an Access Control Rule for OpenMetadata Metadata Operations. All non-null user
 * (subject) and entity (object) attributes are evaluated with logical AND.
 *
 * Describes an entity Lifecycle Rule used within a Policy.
 */
export interface Rule {
  /**
   * Allow or Deny operation on the entity.
   */
  allow?: boolean;
  /**
   * Is the rule enabled.
   */
  enabled?: boolean;
  /**
   * Entity tag that the rule should match on.
   */
  entityTagAttr?: string;
  /**
   * Entity type that the rule should match on.
   */
  entityTypeAttr?: string;
  /**
   * Name for this Rule.
   *
   * Name that identifies this Rule.
   */
  name?: string;
  /**
   * Operation on the entity.
   */
  operation?: Operation;
  /**
   * Priority of this rule among all rules across all policies.
   */
  priority?: number;
  /**
   * Role of the user that the rule should match on.
   */
  userRoleAttr?: string;
  /**
   * A set of actions to take on the entities.
   */
  actions?: LifecycleEAction[];
  prefixFilter?: string;
  regexFilter?: string;
  tagsFilter?: string[];
}

/**
 * An action to delete or expire the entity.
 *
 * An action to move the entity to a different location. For eg: Move from Standard storage
 * tier to Archive storage tier.
 */
export interface LifecycleEAction {
  /**
   * Number of days after creation of the entity that the deletion should be triggered.
   *
   * Number of days after creation of the entity that the move should be triggered.
   */
  daysAfterCreation?: number;
  /**
   * Number of days after last modification of the entity that the deletion should be
   * triggered.
   *
   * Number of days after last modification of the entity that the move should be triggered.
   */
  daysAfterModification?: number;
  /**
   * Location where this entity needs to be moved to.
   */
  destination?: Destination;
}

/**
 * Location where this entity needs to be moved to.
 */
export interface Destination {
  /**
   * The location where to move this entity to.
   */
  location?: Location;
  /**
   * The storage class to move this entity to.
   */
  storageClassType?: StorageClassType;
  /**
   * The storage service to move this entity to.
   */
  storageServiceType?: StorageService;
}

/**
 * The location where to move this entity to.
 *
 * This schema defines the Location entity. A Location can contain the data of a table or
 * group other sublocation together.
 */
export interface Location {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of a location.
   */
  description?: string;
  /**
   * Display Name that identifies this table. It could be title or label from the source
   * services.
   */
  displayName?: string;
  /**
   * Followers of this location.
   */
  followers?: EntityReference[];
  /**
   * Fully qualified name of a location in the form `serviceName.locationName`.
   */
  fullyQualifiedName?: string;
  /**
   * Link to this location resource.
   */
  href?: string;
  /**
   * Unique identifier of this location instance.
   */
  id?: string;
  locationType?: LocationType;
  /**
   * Name of a location without the service. For example s3://bucket/path1/path2.
   */
  name: string;
  /**
   * Owner of this location.
   */
  owner?: EntityReference;
  /**
   * Link to the database cluster/service where this database is hosted in.
   */
  service: EntityReference;
  /**
   * Service type where this storage location is hosted in.
   */
  serviceType?: StorageServiceType;
  /**
   * Tags for this location.
   */
  tags?: TagLabel[];
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
 * This schema defines the type used for describing different types of Location.
 */
export enum LocationType {
  Bucket = 'Bucket',
  Database = 'Database',
  Iceberg = 'Iceberg',
  Prefix = 'Prefix',
  Table = 'Table',
}

/**
 * Service type where this storage location is hosted in.
 *
 * Type of storage service such as S3, GCS, HDFS...
 */
export enum StorageServiceType {
  Abfs = 'ABFS',
  Gcs = 'GCS',
  Hdfs = 'HDFS',
  S3 = 'S3',
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
  /**
   * Unique name of the tag category.
   */
  description?: string;
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
  labelType: LabelType;
  /**
   * Label is from Tags or Glossary.
   */
  source: Source;
  /**
   * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
   * entity must confirm the suggested labels before it is marked as 'Confirmed'.
   */
  state: State;
  tagFQN: string;
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
 * Label is from Tags or Glossary.
 */
export enum Source {
  Glossary = 'Glossary',
  Tag = 'Tag',
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
  Confirmed = 'Confirmed',
  Suggested = 'Suggested',
}

/**
 * The storage class to move this entity to.
 *
 * Type of storage class for the storage service.
 *
 * UUID of Location where this policy is applied
 *
 * Unique id used to identify an entity.
 *
 * Unique identifier that identifies an entity instance.
 *
 * Unique identifier of this location instance.
 *
 * Unique identifier of this storage service instance.
 *
 * Link to the entity resource.
 *
 * URI that points to a resource.
 *
 * Link to this location resource.
 *
 * Link to the tag resource.
 *
 * Link to the resource corresponding to this storage service.
 *
 * Name of the entity field that changed.
 *
 * Name of the field of an entity.
 *
 * Prefix path of the entity.
 *
 * Regex that matches the entity.
 *
 * Type of storage class offered by S3.
 *
 * Type of storage class offered by GCS.
 *
 * Type of storage class offered by ABFS.
 */
export enum StorageClassType {
  Archive = 'ARCHIVE',
  Coldline = 'COLDLINE',
  Cool = 'COOL',
  DeepArchive = 'DEEP_ARCHIVE',
  DurableReducedAvailability = 'DURABLE_REDUCED_AVAILABILITY',
  Glacier = 'GLACIER',
  Hot = 'HOT',
  IntelligentTiering = 'INTELLIGENT_TIERING',
  MultiRegional = 'MULTI_REGIONAL',
  Nearline = 'NEARLINE',
  OnezoneIa = 'ONEZONE_IA',
  Outposts = 'OUTPOSTS',
  ReducedRedundancy = 'REDUCED_REDUNDANCY',
  Regional = 'REGIONAL',
  Standard = 'STANDARD',
  StandardIa = 'STANDARD_IA',
}

/**
 * The storage service to move this entity to.
 *
 * This schema defines the Storage Service entity, such as S3, GCS, HDFS.
 */
export interface StorageService {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of a storage service instance.
   */
  description?: string;
  /**
   * Display Name that identifies this storage service.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this storage service.
   */
  href: string;
  /**
   * Unique identifier of this storage service instance.
   */
  id: string;
  /**
   * Name that identifies this storage service.
   */
  name: string;
  /**
   * Owner of this storage service.
   */
  owner?: EntityReference;
  /**
   * Type of storage service such as S3, GCS, HDFS...
   */
  serviceType: StorageServiceType;
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
 * Operation on the entity.
 *
 * This schema defines all possible operations on metadata of data entities.
 */
export enum Operation {
  DecryptTokens = 'DecryptTokens',
  SuggestDescription = 'SuggestDescription',
  SuggestTags = 'SuggestTags',
  UpdateDescription = 'UpdateDescription',
  UpdateLineage = 'UpdateLineage',
  UpdateOwner = 'UpdateOwner',
  UpdateTags = 'UpdateTags',
  UpdateTeam = 'UpdateTeam',
}
