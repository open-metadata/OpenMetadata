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
 * This schema defines the Model entity. Models are algorithms trained on data to find
 * patterns or make predictions.
 */
export interface Mlmodel {
  /**
   * Algorithm used to train the ML Model.
   */
  algorithm: string;
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * Performance Dashboard URL to track metric evolution.
   */
  dashboard?: EntityReference;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of the ML Model, what it is, and how to use it.
   */
  description?: string;
  /**
   * Display Name that identifies this ML Model.
   */
  displayName?: string;
  /**
   * Followers of this ML Model.
   */
  followers?: EntityReference[];
  /**
   * A unique name that identifies an ML Model.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href?: string;
  /**
   * Unique identifier of an ML Model instance.
   */
  id: string;
  /**
   * Features used to train the ML Model.
   */
  mlFeatures?: MlFeature[];
  /**
   * Hyper Parameters used to train the ML Model.
   */
  mlHyperParameters?: MlHyperParameter[];
  /**
   * Location containing the ML Model. It can be a storage layer and/or a container repository.
   */
  mlStore?: MlStore;
  /**
   * Name that identifies this ML Model.
   */
  name: string;
  /**
   * Owner of this ML Model.
   */
  owner?: EntityReference;
  /**
   * Endpoint that makes the ML Model available, e.g,. a REST API serving the data or
   * computing predictions.
   */
  server?: string;
  /**
   * Tags for this ML Model.
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
   * Latest usage information for this ML Model.
   */
  usageSummary?: TypeUsedToReturnUsageDetailsOfAnEntity;
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
 * Performance Dashboard URL to track metric evolution.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Followers of this ML Model.
 *
 * Description of the Data Source (e.g., a Table)
 *
 * Owner of this ML Model.
 */
export interface EntityReference {
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
 * This schema defines the type for an ML Feature used in an ML Model.
 */
export interface MlFeature {
  /**
   * Data type of the column (numerical vs. categorical).
   */
  dataType?: FeatureType;
  /**
   * Description of the ML Feature.
   */
  description?: string;
  /**
   * Description of the algorithm used to compute the feature, e.g., PCA, bucketing...
   */
  featureAlgorithm?: string;
  /**
   * Columns used to create the ML Feature.
   */
  featureSources?: FeatureSource[];
  fullyQualifiedName?: string;
  name?: string;
  /**
   * Tags associated with the feature.
   */
  tags?: TagLabel[];
}

/**
 * Data type of the column (numerical vs. categorical).
 *
 * This enum defines the type of data stored in a ML Feature.
 */
export enum FeatureType {
  Categorical = 'categorical',
  Numerical = 'numerical',
}

/**
 * This schema defines the sources of a ML Feature.
 */
export interface FeatureSource {
  /**
   * Description of the Data Source (e.g., a Table)
   */
  dataSource?: EntityReference;
  /**
   * Data type of the source (int, date etc.).
   */
  dataType?: FeatureSourceDataType;
  /**
   * Description of the feature source.
   */
  description?: string;
  fullyQualifiedName?: string;
  name?: string;
  /**
   * Tags associated with the feature source.
   */
  tags?: TagLabel[];
}

/**
 * Data type of the source (int, date etc.).
 *
 * This enum defines the type of data of a ML Feature source.
 */
export enum FeatureSourceDataType {
  Array = 'array',
  Boolean = 'boolean',
  Date = 'date',
  Integer = 'integer',
  Number = 'number',
  Object = 'object',
  String = 'string',
  Timestamp = 'timestamp',
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
 * This schema defines the type for an ML HyperParameter used in an ML Model.
 */
export interface MlHyperParameter {
  /**
   * Description of the Hyper Parameter.
   */
  description?: string;
  /**
   * Hyper parameter name.
   */
  name?: string;
  /**
   * Hyper parameter value.
   */
  value?: string;
}

/**
 * Location containing the ML Model. It can be a storage layer and/or a container repository.
 */
export interface MlStore {
  /**
   * Container Repository with the ML Model image.
   */
  imageRepository?: string;
  /**
   * Storage Layer containing the ML Model data.
   */
  storage?: string;
}

/**
 * Latest usage information for this ML Model.
 *
 * This schema defines the type for usage details. Daily, weekly, and monthly aggregation of
 * usage is computed along with the percentile rank based on the usage for a given day.
 */
export interface TypeUsedToReturnUsageDetailsOfAnEntity {
  /**
   * Daily usage stats of a data asset on the start date.
   */
  dailyStats: UsageStats;
  /**
   * Date in UTC.
   */
  date: Date;
  /**
   * Monthly (last 30 days) rolling usage stats of a data asset on the start date.
   */
  monthlyStats?: UsageStats;
  /**
   * Weekly (last 7 days) rolling usage stats of a data asset on the start date.
   */
  weeklyStats?: UsageStats;
}

/**
 * Daily usage stats of a data asset on the start date.
 *
 * Type used to return usage statistics.
 *
 * Monthly (last 30 days) rolling usage stats of a data asset on the start date.
 *
 * Weekly (last 7 days) rolling usage stats of a data asset on the start date.
 */
export interface UsageStats {
  /**
   * Usage count of a data asset on the start date.
   */
  count: number;
  /**
   * Optional daily percentile rank data asset use when relevant.
   */
  percentileRank?: number;
}
