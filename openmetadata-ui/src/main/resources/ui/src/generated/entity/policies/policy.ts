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
 * This schema defines the Policy entity. A Policy defines lifecycle or access control that
 * needs to be applied across different Data Entities.
 */
export interface Policy {
  /**
   * Change that led to this version of the Policy.
   */
  changeDescription?: PolicyChangeDescription;
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
   * Name that uniquely identifies a Policy.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href?: string;
  /**
   * Unique identifier that identifies this Policy.
   */
  id: string;
  /**
   * Name that identifies this Policy.
   */
  name: string;
  /**
   * Owner of this Policy.
   */
  owner?: PolicyOwner;
  policyType: PolicyType;
  /**
   * Link to a well documented definition of this Policy.
   */
  policyUrl?: string;
  /**
   * A set of rules associated with this Policy.
   */
  rules?: Rule[];
  /**
   * Last update time corresponding to the new version of the Policy.
   */
  updatedAt?: Date;
  /**
   * User who made the update.
   */
  updatedBy?: string;
  /**
   * Metadata version of the Policy.
   */
  version?: number;
}

/**
 * Change that led to this version of the Policy.
 *
 * Description of the change.
 */
export interface PolicyChangeDescription {
  /**
   * Names of fields added during the version changes.
   */
  fieldsAdded?: PurpleFieldChange[];
  /**
   * Fields deleted during the version changes with old value before deleted.
   */
  fieldsDeleted?: PurpleFieldChange[];
  /**
   * Fields modified during the version changes with old and new values.
   */
  fieldsUpdated?: PurpleFieldChange[];
  /**
   * When a change did not result in change, this could be same as the current version.
   */
  previousVersion?: number;
}

export interface PurpleFieldChange {
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
 * Owner of this Policy.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface PolicyOwner {
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
 * This schema defines the type used for describing different types of policies.
 */
export enum PolicyType {
  AccessControl = 'AccessControl',
  Lifecycle = 'Lifecycle',
}

/**
 * Describes an entity Access Control Rule used within a Policy
 *
 * Describes an entity Lifecycle Rule used within a Policy
 */
export interface Rule {
  /**
   * A set of access control enforcements to take on the entities.
   *
   * A set of actions to take on the entities.
   */
  actions: TagBased[];
  filters: Array<TagLabel | string>;
}

/**
 * Describes an Access Control Rule to selectively grant access to Teams/Users to tagged
 * entities.
 *
 * An action to delete or expire the entity.
 *
 * An action to move the entity to a different location. For eg: Move from Standard storage
 * tier to Archive storage tier.
 */
export interface TagBased {
  /**
   * Teams and Users who are able to access the tagged entities.
   */
  allow?: Team[];
  /**
   * Tags that are associated with the entities.
   */
  tags?: TagLabel[];
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
 * This schema defines the Team entity. A Team is a group of zero or more users. Teams can
 * own zero or more data assets.
 *
 * This schema defines the User entity. A user can be part of 0 or more teams. A special
 * type of user called Bot is used for automation. A user can be an owner of zero or more
 * data assets. A user can also follow zero or more data assets.
 */
export interface Team {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: AllowChangeDescription;
  /**
   * When true the team has been deleted.
   */
  deleted?: boolean;
  /**
   * Description of the team.
   *
   * Used for user biography.
   */
  description?: string;
  /**
   * Name used for display purposes. Example 'Data Science team'.
   *
   * Name used for display purposes. Example 'FirstName LastName'.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href: string;
  /**
   * Unique identifier that identifies a user entity instance.
   */
  id: string;
  name: string;
  /**
   * List of entities owned by the team.
   *
   * List of entities owned by the user.
   */
  owns?: OwnerElement[];
  /**
   * Team profile information.
   *
   * Profile of the user.
   */
  profile?: Profile;
  /**
   * Last update time corresponding to the new version of the entity.
   */
  updatedAt?: Date;
  /**
   * User who made the update.
   */
  updatedBy?: string;
  /**
   * Users that are part of the team.
   */
  users?: OwnerElement[];
  /**
   * Metadata version of the entity.
   */
  version?: number;
  /**
   * When true indicates the user has been deactivated. Users are deactivated instead of
   * deleted.
   */
  deactivated?: boolean;
  /**
   * Email address of the user.
   */
  email?: string;
  /**
   * List of entities followed by the user.
   */
  follows?: OwnerElement[];
  /**
   * When true indicates user is an administrator for the system with superuser privileges.
   */
  isAdmin?: boolean;
  /**
   * When true indicates a special type of user called Bot.
   */
  isBot?: boolean;
  /**
   * Teams that the user belongs to.
   */
  teams?: OwnerElement[];
  /**
   * Timezone of the user.
   */
  timezone?: string;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface AllowChangeDescription {
  /**
   * Names of fields added during the version changes.
   */
  fieldsAdded?: FluffyFieldChange[];
  /**
   * Fields deleted during the version changes with old value before deleted.
   */
  fieldsDeleted?: FluffyFieldChange[];
  /**
   * Fields modified during the version changes with old and new values.
   */
  fieldsUpdated?: FluffyFieldChange[];
  /**
   * When a change did not result in change, this could be same as the current version.
   */
  previousVersion?: number;
}

export interface FluffyFieldChange {
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
 * List of entities owned by the team.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owner of this location.
 *
 * Link to the database cluster/service where this database is hosted in.
 */
export interface OwnerElement {
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
 * Team profile information.
 *
 * This schema defines the type for a profile of a user, team, or organization.
 *
 * Profile of the user.
 */
export interface Profile {
  images?: ImageList;
}

/**
 * Links to a list of images of varying resolutions/sizes.
 */
export interface ImageList {
  image?: string;
  image192?: string;
  image24?: string;
  image32?: string;
  image48?: string;
  image512?: string;
  image72?: string;
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
  changeDescription?: AllowChangeDescription;
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
  followers?: OwnerElement[];
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
  owner?: OwnerElement;
  /**
   * Link to the database cluster/service where this database is hosted in.
   */
  service: OwnerElement;
  /**
   * Service type where this storage location is hosted in.
   */
  serviceType?: StorageServiceType;
  /**
   * Tags for this location.
   */
  tags?: TagElement[];
  /**
   * Last update time corresponding to the new version of the entity.
   */
  updatedAt?: Date;
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
 * This schema defines the type used for describing different types of Location.
 */
export enum LocationType {
  Bucket = 'Bucket',
  Database = 'Database',
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
export interface TagElement {
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
 * Type of storage class for the storage service
 *
 * Name of the entity field that changed.
 *
 * Name of the field of an entity.
 *
 * Link to the resource corresponding to this entity.
 *
 * URI that points to a resource.
 *
 * Unique identifier that identifies this Policy.
 *
 * Unique id used to identify an entity.
 *
 * Link to the entity resource.
 *
 * Link to the tag resource.
 *
 * Link to this location resource.
 *
 * Link to the resource corresponding to this storage service.
 *
 * Unique identifier that identifies an entity instance.
 *
 * Unique identifier that identifies a user entity instance.
 *
 * Unique identifier of this location instance.
 *
 * Unique identifier of this storage service instance.
 *
 * Regex that matches the entity FQN.
 *
 * Type of storage class offered by S3
 *
 * Type of storage class offered by GCS
 *
 * Type of storage class offered by ABFS
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
  changeDescription?: AllowChangeDescription;
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
   * Type of storage service such as S3, GCS, HDFS...
   */
  serviceType: StorageServiceType;
  /**
   * Last update time corresponding to the new version of the entity.
   */
  updatedAt?: Date;
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
 * This schema defines the type for labeling an entity with a Tag.
 *
 * Entity tags to match on.
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
   * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
   * entity must confirm the suggested labels before it is marked as 'Confirmed'.
   */
  state: State;
  tagFQN: string;
}
