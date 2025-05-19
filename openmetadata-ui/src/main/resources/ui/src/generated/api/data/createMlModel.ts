/*
 *  Copyright 2025 Collate.
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
 * Create Ml Model entity request
 */
export interface CreateMlModel {
    /**
     * Algorithm used to train the ML Model
     */
    algorithm?: string;
    /**
     * Performance Dashboard fqn to track metric evolution
     */
    dashboard?: string;
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Description of the ML model instance. How it was trained and for what it is used.
     */
    description?: string;
    /**
     * Display Name that identifies this ML model. It could be title or label from the source
     * services
     */
    displayName?: string;
    /**
     * Fully qualified name of the domain the MLModel belongs to.
     */
    domain?: string;
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Life Cycle of the entity
     */
    lifeCycle?: LifeCycle;
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
     * Name that identifies this ML model.
     */
    name: string;
    /**
     * Owners of this database
     */
    owners?: EntityReference[];
    /**
     * Endpoint that makes the ML Model available, e.g,. a REST API serving the data or
     * computing predictions.
     */
    server?: string;
    /**
     * Link to the MLModel service fqn where this pipeline is hosted in
     */
    service: string;
    /**
     * Source hash of the entity
     */
    sourceHash?: string;
    /**
     * Source URL of mlModel.
     */
    sourceUrl?: string;
    /**
     * Tags for this ML Model
     */
    tags?: TagLabel[];
    /**
     * For supervised ML Models, the value to estimate.
     */
    target?: string;
}

/**
 * Life Cycle of the entity
 *
 * This schema defines Life Cycle Properties.
 */
export interface LifeCycle {
    /**
     * Access Details about accessed aspect of the data asset
     */
    accessed?: AccessDetails;
    /**
     * Access Details about created aspect of the data asset
     */
    created?: AccessDetails;
    /**
     * Access Details about updated aspect of the data asset
     */
    updated?: AccessDetails;
}

/**
 * Access Details about accessed aspect of the data asset
 *
 * Access details of an entity
 *
 * Access Details about created aspect of the data asset
 *
 * Access Details about updated aspect of the data asset
 */
export interface AccessDetails {
    /**
     * User, Pipeline, Query that created,updated or accessed the data asset
     */
    accessedBy?: EntityReference;
    /**
     * Any process that accessed the data asset that is not captured in OpenMetadata.
     */
    accessedByAProcess?: string;
    /**
     * Timestamp of data asset accessed for creation, update, read.
     */
    timestamp: number;
}

/**
 * User, Pipeline, Query that created,updated or accessed the data asset
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Description of the Data Source (e.g., a Table).
 *
 * Owners of this database
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
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
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
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
    featureSources?:     FeatureSource[];
    fullyQualifiedName?: string;
    name?:               string;
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
    Categorical = "categorical",
    Numerical = "numerical",
}

/**
 * This schema defines the sources of a ML Feature.
 */
export interface FeatureSource {
    /**
     * Description of the Data Source (e.g., a Table).
     */
    dataSource?: EntityReference;
    /**
     * Data type of the source (int, date etc.).
     */
    dataType?: FeatureSourceDataType;
    /**
     * Description of the feature source.
     */
    description?:        string;
    fullyQualifiedName?: string;
    name?:               string;
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
    Array = "array",
    Boolean = "boolean",
    Date = "date",
    Integer = "integer",
    Number = "number",
    Object = "object",
    String = "string",
    Timestamp = "timestamp",
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
    /**
     * Description for the tag label.
     */
    description?: string;
    /**
     * Display Name that identifies this tag.
     */
    displayName?: string;
    /**
     * Link to the tag resource.
     */
    href?: string;
    /**
     * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
     * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
     * relationship (see Classification.json for more details). 'Propagated` indicates a tag
     * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
     * used to determine the tag label.
     */
    labelType: LabelType;
    /**
     * Name of the tag or glossary term.
     */
    name?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state:  State;
    style?: Style;
    tagFQN: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see Classification.json for more details). 'Propagated` indicates a tag
 * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
 * used to determine the tag label.
 */
export enum LabelType {
    Automated = "Automated",
    Derived = "Derived",
    Generated = "Generated",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * Label is from Tags or Glossary.
 */
export enum TagSource {
    Classification = "Classification",
    Glossary = "Glossary",
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
    Confirmed = "Confirmed",
    Suggested = "Suggested",
}

/**
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
    /**
     * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
     */
    color?: string;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
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
