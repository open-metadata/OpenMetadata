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
 * A `Data Product` or `Data as a Product` is a logical unit that contains all components to
 * process and store data for analytical or data-intensive use cases made available to data
 * consumers.
 */
export interface DataProduct {
    /**
     * Data assets collection that is part of this data product.
     */
    assets?: EntityReference[];
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * Other data products that this product consumes data from
     */
    consumesFrom?: EntityReference[];
    /**
     * Description of the Data Product.
     */
    description: string;
    /**
     * Name used for display purposes. Example 'Marketing', 'Payments', etc.
     */
    displayName?: string;
    /**
     * Domains or sub-domains to which this Data Product belongs to.
     */
    domains?: EntityReference[];
    /**
     * Status of the Data Product.
     */
    entityStatus?: EntityStatus;
    /**
     * List of users who are experts for this Data Product.
     */
    experts?: EntityReference[];
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Followers of this entity.
     */
    followers?: EntityReference[];
    /**
     * FullyQualifiedName is `domain.dataProductName` or `sub-domain.dataProductName`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique ID of the Data Product
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Input ports for consuming data into this data product
     */
    inputPorts?: DataProductPort[];
    /**
     * Current lifecycle stage of the data product
     */
    lifecycleStage?: LifecycleStage;
    /**
     * A unique name of the Data Product
     */
    name: string;
    /**
     * Output ports for exposing data from this data product
     */
    outputPorts?: DataProductPort[];
    /**
     * Owners of this Data Product.
     */
    owners?: EntityReference[];
    /**
     * Other data products that consume data from this product
     */
    providesTo?: EntityReference[];
    /**
     * User references of the reviewers for this Data Product.
     */
    reviewers?: EntityReference[];
    /**
     * Service Level Agreement for this data product
     */
    sla?:   SlaDefinition;
    style?: Style;
    /**
     * Tags associated with the Data Product.
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
 * Data assets collection that is part of this data product.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the data asset exposed through this port
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
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
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

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
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
 * Status of the Data Product.
 *
 * Status of an entity. It is used for governance and is applied to all the entities in the
 * catalog.
 */
export enum EntityStatus {
    Approved = "Approved",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
}

/**
 * Port definition for data product input/output
 */
export interface DataProductPort {
    /**
     * Reference to the data asset exposed through this port
     */
    dataAsset?: EntityReference;
    /**
     * Description of the port
     */
    description?: string;
    /**
     * Display name of the port
     */
    displayName?: string;
    /**
     * Endpoint URL or connection string
     */
    endpoint?: string;
    format?:   PortFormat;
    /**
     * Name of the port
     */
    name:      string;
    portType:  PortType;
    protocol?: PortProtocol;
}

/**
 * Data format supported by the port
 */
export enum PortFormat {
    Avro = "AVRO",
    CSV = "CSV",
    Custom = "CUSTOM",
    Delta = "DELTA",
    Iceberg = "ICEBERG",
    JSON = "JSON",
    Orc = "ORC",
    Parquet = "PARQUET",
    Protobuf = "PROTOBUF",
    XML = "XML",
}

/**
 * Type of the data product port
 */
export enum PortType {
    Input = "INPUT",
    Output = "OUTPUT",
}

/**
 * Protocol used by the port for data access
 */
export enum PortProtocol {
    AzureBlob = "AZURE_BLOB",
    Custom = "CUSTOM",
    File = "FILE",
    Gcs = "GCS",
    Graphql = "GRAPHQL",
    Grpc = "GRPC",
    JDBC = "JDBC",
    Kafka = "KAFKA",
    REST = "REST",
    S3 = "S3",
    Webhook = "WEBHOOK",
}

/**
 * Current lifecycle stage of the data product
 *
 * Lifecycle stage of the data product
 */
export enum LifecycleStage {
    Deprecated = "DEPRECATED",
    Design = "DESIGN",
    Development = "DEVELOPMENT",
    Ideation = "IDEATION",
    Production = "PRODUCTION",
    Retired = "RETIRED",
    Testing = "TESTING",
}

/**
 * Service Level Agreement for this data product
 *
 * Service Level Agreement definition
 */
export interface SlaDefinition {
    /**
     * Expected availability percentage (e.g., 99.9)
     */
    availability?: number;
    /**
     * Maximum data staleness in minutes
     */
    dataFreshness?: number;
    /**
     * Minimum data quality score
     */
    dataQuality?: number;
    /**
     * Expected response time in milliseconds
     */
    responseTime?: number;
    /**
     * SLA tier (e.g., GOLD, SILVER, BRONZE)
     */
    tier?: Tier;
}

/**
 * SLA tier (e.g., GOLD, SILVER, BRONZE)
 */
export enum Tier {
    Bronze = "BRONZE",
    Custom = "CUSTOM",
    Gold = "GOLD",
    Silver = "SILVER",
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
