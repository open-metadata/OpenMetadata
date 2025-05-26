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
 * Apply a set of operations on a service
 */
export interface ReverseIngestionPipeline {
    /**
     * Optional value of the ingestion runner name responsible for running the workflow
     */
    ingestionRunner?: string;
    /**
     * List of operations to be performed on the service
     */
    operations: Operation[];
    /**
     * Service to be modified
     */
    service: EntityReference;
    /**
     * Pipeline type
     */
    type: ReverseIngestionType;
}

/**
 * Operation to be performed on the entity
 */
export interface Operation {
    /**
     * Entity to be modified
     */
    entityLink: string;
    /**
     * The id of the operation
     */
    id: string;
    /**
     * The configuration for the operation to be applied
     */
    parameters: ReverseIngestionConfig;
    /**
     * Templated SQL command to be used for the operation. Context parameters will be populated
     * based on the event type.
     */
    SQLTemplate?: string;
    /**
     * Type of operation to perform
     */
    type: Type;
}

/**
 * The configuration for the operation to be applied
 *
 * Configuration for updating descriptions
 *
 * Configuration for updating owners
 *
 * Configuration for updating tags
 */
export interface ReverseIngestionConfig {
    /**
     * New description of the service
     */
    newDescription?: string;
    /**
     * Previous description of the service
     */
    previousDescription?: string;
    /**
     * Added owners to be applied
     */
    addedOwners?: EntityReference[];
    /**
     * Removed owners from the entity
     */
    removedOwners?: EntityReference[];
    /**
     * Added tags to be applied
     */
    addedTags?: TagLabel[];
    /**
     * Removed tags of the entity
     */
    removedTags?: TagLabel[];
}

/**
 * Added owners to be applied
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
 * Service to be modified
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
 * Type of operation to perform
 */
export enum Type {
    UpdateDescription = "UPDATE_DESCRIPTION",
    UpdateOwner = "UPDATE_OWNER",
    UpdateTags = "UPDATE_TAGS",
}

/**
 * Pipeline type
 *
 * Reverse Ingestion Config Pipeline type
 */
export enum ReverseIngestionType {
    ReverseIngestion = "ReverseIngestion",
}
