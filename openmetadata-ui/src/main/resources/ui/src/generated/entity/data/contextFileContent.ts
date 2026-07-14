/*
 *  Copyright 2026 Collate.
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
 * A stored content snapshot for a ContextFile.
 */
export interface ContextFileContent {
    /**
     * Reference to the Asset entity storing the actual file blob.
     */
    assetId?: string;
    /**
     * Change that led to this version.
     */
    changeDescription?: ChangeDescription;
    /**
     * SHA-256 checksum of the stored content.
     */
    checksum?: string;
    /**
     * MIME type of the stored content.
     */
    contentType?: string;
    /**
     * The file this content snapshot belongs to.
     */
    contextFile: EntityReference;
    /**
     * When true indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the content snapshot.
     */
    description?: string;
    /**
     * Display name of the content snapshot.
     */
    displayName?: string;
    /**
     * Canonical extracted text for this content snapshot.
     */
    extractedText?: string;
    /**
     * Fully qualified name of the content snapshot.
     */
    fullyQualifiedName?: string;
    /**
     * Link to this resource.
     */
    href?: string;
    /**
     * Unique identifier of the content snapshot.
     */
    id: string;
    /**
     * Incremental change that led to this version.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Time the content snapshot was ingested.
     */
    ingestedAt?: number;
    /**
     * Whether this is the current content snapshot for the file.
     */
    isCurrent?: boolean;
    /**
     * Name of the content snapshot.
     */
    name: string;
    /**
     * Processing failure details for this snapshot.
     */
    processingError?: string;
    /**
     * Processing status for this content snapshot.
     */
    processingStatus?: ProcessingStatus;
    /**
     * Content size in bytes.
     */
    size?: number;
    /**
     * Provider revision or version token for synced files.
     */
    sourceVersion?: string;
    /**
     * Last update time in Unix epoch time milliseconds.
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
 * Change that led to this version.
 *
 * Description of the change.
 *
 * Incremental change that led to this version.
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
 * The file this content snapshot belongs to.
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
 * Processing status for this content snapshot.
 *
 * Processing state of the file after upload.
 */
export enum ProcessingStatus {
    Analyzing = "Analyzing",
    Failed = "Failed",
    Processed = "Processed",
    Unsupported = "Unsupported",
    Uploaded = "Uploaded",
}
