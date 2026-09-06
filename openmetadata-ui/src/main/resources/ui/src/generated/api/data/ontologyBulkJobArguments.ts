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
 * Typed payload persisted for an ontology bulk background job.
 */
export interface OntologyBulkJobArguments {
    glossary: EntityReference;
    request:  OntologyBulkRequest;
}

/**
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
 * Typed QTT-style bulk authoring request for an ontology glossary.
 */
export interface OntologyBulkRequest {
    changeSetDescription:  string;
    changeSetDisplayName?: string;
    changeSetName:         string;
    /**
     * UTF-8 CSV payload for CSV_UPSERT.
     */
    csv?:         string;
    dryRun:       boolean;
    findReplace?: FindReplace;
    glossaryId:   string;
    operation:    Operation;
    retype?:      Retype;
}

export interface FindReplace {
    caseSensitive: boolean;
    field:         MatchField;
    find:          string;
    matchMode:     MatchMode;
    replacement:   string;
}

export enum MatchField {
    Description = "DESCRIPTION",
    DisplayName = "DISPLAY_NAME",
    Name = "NAME",
}

export enum MatchMode {
    Contains = "CONTAINS",
    Exact = "EXACT",
}

export enum Operation {
    CSVUpsert = "CSV_UPSERT",
    FindReplace = "FIND_REPLACE",
    RetypeRelationships = "RETYPE_RELATIONSHIPS",
}

export interface Retype {
    fromRelationshipTypeId: string;
    /**
     * Optional bounded term scope. Omit to inspect every term in the glossary.
     */
    termIds?:             string[];
    toRelationshipTypeId: string;
}
