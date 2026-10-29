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
 * Sealed ontology content, stored as immutable SQL members and reviewed through the
 * existing approval workflow.
 */
export interface OntologyRelease {
    /**
     * Active release at capture, retained as the immutable review comparison baseline.
     */
    baseReleaseId?:     string;
    changeDescription?: ChangeDescription;
    /**
     * Member change counts against baseReleaseId, assigned by the server at capture. Absent on
     * releases captured before change summaries existed.
     */
    changeSummary?: OntologyReleaseChangeSummary;
    /**
     * SHA-256 of the sealed manifest, including ordered member identities and payload digests.
     */
    contentDigest: string;
    deleted?:      boolean;
    description?:  string;
    displayName?:  string;
    /**
     * Canonical manifest and member encoding used to reproduce the digest.
     */
    encodingVersion:               EncodingVersion;
    entityStatus:                  EntityStatus;
    fullyQualifiedName:            string;
    href?:                         string;
    id:                            string;
    impersonatedBy?:               string;
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Logical consistency has not been checked. Structural and OWL 2 DL profile checks do not
     * establish consistency.
     */
    logicalCheck: LogicalCheck;
    memberCount:  number;
    name:         string;
    ontology:     EntityReference;
    ontologyIri:  string;
    owners?:      EntityReference[];
    provider?:    ProviderType;
    /**
     * Immutable publication notes preserved exactly as captured, independently of the semantic
     * content digest.
     */
    releaseNotes?: string;
    /**
     * Monotonic release number allocated under the owning ontology state lock.
     */
    releaseRevision: number;
    /**
     * Author of the current governed content revision; assigned by the server.
     */
    reviewAuthor?: string;
    reviewers?:    EntityReference[];
    /**
     * Current approval task, assigned by the existing workflow infrastructure. Clients cannot
     * set this field.
     */
    reviewTask?: string;
    sealedAt:    number;
    sealedBy:    string;
    /**
     * Immutable semantic version allocated by the server. Absent on legacy releases;
     * independent of entity version, release revision and version IRI.
     */
    semanticVersion?:      string;
    sourceWorkingRevision: number;
    /**
     * Total UTF-8 size of canonical member payloads.
     */
    totalBytes: number;
    updatedAt?: number;
    updatedBy?: string;
    version?:   number;
    versionIri: string;
}

/**
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
 * Member change counts against baseReleaseId, assigned by the server at capture. Absent on
 * releases captured before change summaries existed.
 *
 * Member change counts of a release against the release that was active when it was
 * captured. The counts partition the rows of GET /v1/ontologyReleases/{id}/diff with its
 * default base.
 */
export interface OntologyReleaseChangeSummary {
    added:   number;
    changed: number;
    removed: number;
}

/**
 * Canonical manifest and member encoding used to reproduce the digest.
 */
export enum EncodingVersion {
    OntologyReleaseV1 = "ontology-release-v1",
}

/**
 * General lifecycle stage for entities that reference this vocabulary. Specialized entities
 * can declare their own status schema and lifecycle policy. Entity types without an
 * entityStatus property have no lifecycle. When a create request omits the stage, the
 * server assigns the entity type's initial stage.
 */
export enum EntityStatus {
    Approved = "Approved",
    Archived = "Archived",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
    Unprocessed = "Unprocessed",
}

/**
 * Logical consistency has not been checked. Structural and OWL 2 DL profile checks do not
 * establish consistency.
 */
export enum LogicalCheck {
    NotRun = "NOT_RUN",
}

/**
 * Owning ontology entity. Glossaries do not own ontology definitions.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
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
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}
