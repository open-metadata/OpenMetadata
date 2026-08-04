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
 * Typed dry-run or commit result for an OWL/SKOS ontology import.
 */
export interface OntologyImportResult {
    /**
     * Lossless annex revisions created by a committed import.
     */
    annexRevisions:       OntologyAnnexRevision[];
    conceptMappingsAdded: number;
    /**
     * Per-concept ontology attributes created from OWL datatype properties. The legacy field
     * name is retained for API compatibility.
     */
    customPropertiesCreated: number;
    dryRun:                  boolean;
    glossariesCreated:       number;
    messages:                string[];
    relationsAdded:          number;
    relationTypesRegistered: number;
    termsCreated:            number;
    termsUpdated:            number;
    validationReport:        RDFValidationReport;
}

/**
 * An immutable revision of losslessly preserved ontology axioms.
 */
export interface OntologyAnnexRevision {
    canonicalNQuads: string;
    checksum:        string;
    createdAt:       number;
    createdBy:       string;
    glossary:        EntityReference;
    revision:        number;
    source:          Source;
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

export enum Source {
    Authoring = "AUTHORING",
    Import = "IMPORT",
    Migration = "MIGRATION",
}

/**
 * Bounded, typed SHACL validation result for RDF import and governance APIs.
 */
export interface RDFValidationReport {
    conforms: boolean;
    /**
     * Whether SHACL validation was executed for this operation.
     */
    performed: boolean;
    /**
     * Complete machine-readable SHACL report serialized as Turtle.
     */
    reportTurtle: string;
    /**
     * Whether the typed violation list was capped while reportTurtle remains complete.
     */
    truncated:      boolean;
    violationCount: number;
    violations:     Violation[];
}

export interface Violation {
    focusNode:         string;
    message:           string;
    resultPath?:       string;
    severity:          string;
    sourceConstraint?: string;
    value?:            string;
}
