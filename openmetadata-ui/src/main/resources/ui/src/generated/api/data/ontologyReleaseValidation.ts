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
 * Structure and native SHACL findings for a captured release, with current authorized
 * bindings for newly deprecated definitions. Logical consistency is not checked.
 */
export interface OntologyReleaseValidation {
    baseReleaseId?:     string;
    contentDigest:      string;
    deprecationImpacts: Impact[];
    logicalCheck:       LogicalCheck;
    releaseId:          string;
    shacl:              Shacl;
    structure:          OntologyReleaseStructureReport;
    valid:              boolean;
}

export interface Impact {
    boundAssetCount:  number;
    boundAssets:      EntityReference[];
    definition:       EntityReference;
    domainProperties: EntityReference[];
    rangeProperties:  EntityReference[];
    subclasses:       EntityReference[];
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

export enum LogicalCheck {
    NotRun = "NOT_RUN",
}

export interface Shacl {
    findings:       Finding[];
    truncated:      boolean;
    violationCount: number;
    warningCount:   number;
}

export interface Finding {
    focusIri: string;
    message:  string;
    severity: FindingSeverity;
    shapeIri: string;
}

export enum FindingSeverity {
    Violation = "VIOLATION",
    Warning = "WARNING",
}

/**
 * Declaration, reference-kind and axiom-shape checks over a sealed release and its pinned
 * imports. This is not a complete OWL 2 DL profile check, a logical consistency result, or
 * publication approval.
 */
export interface OntologyReleaseStructureReport {
    contentDigest: string;
    releaseId:     string;
    /**
     * True only when these structural checks find no violations. Other required publication
     * checks are independent.
     */
    valid: boolean;
    /**
     * Total findings, including those beyond the response limit.
     */
    violationCount: number;
    /**
     * At most 1000 findings in release/member order. Compare the length with violationCount to
     * detect truncation.
     */
    violations: Issue[];
}

export interface Issue {
    memberId:   string;
    memberKind: MemberKind;
    /**
     * Owning release when validating captured content; absent for a working definition.
     */
    releaseId?: string;
    violation:  OntologyProfileViolation;
}

/**
 * Unique id used to identify an entity.
 *
 * Unique identifier that identifies an entity instance.
 *
 * Owning release when validating captured content; absent for a working definition.
 *
 * Optional description of entity.
 *
 * Text in Markdown format.
 *
 * Link to the entity resource.
 *
 * URI that points to a resource.
 *
 * Absolute semantic IRI, preserved exactly without URL normalization, case folding, or
 * percent encoding.
 */
export enum MemberKind {
    Association = "ASSOCIATION",
    Axiom = "AXIOM",
    Concept = "CONCEPT",
    Ontology = "ONTOLOGY",
    Property = "PROPERTY",
    Shape = "SHAPE",
}

/**
 * A typed OWL 2 DL profile guardrail finding.
 */
export interface OntologyProfileViolation {
    code:     Code;
    message:  string;
    path:     string;
    severity: ViolationSeverity;
}

export enum Code {
    IllegalPunning = "ILLEGAL_PUNNING",
    InvalidAxiomShape = "INVALID_AXIOM_SHAPE",
    InvalidClassKind = "INVALID_CLASS_KIND",
    InvalidExpressionShape = "INVALID_EXPRESSION_SHAPE",
    NonSimpleCardinality = "NON_SIMPLE_CARDINALITY",
    NonSimpleProperty = "NON_SIMPLE_PROPERTY",
    PropertyChainRegularity = "PROPERTY_CHAIN_REGULARITY",
    ReservedSubjectIRI = "RESERVED_SUBJECT_IRI",
    SubclassCycle = "SUBCLASS_CYCLE",
    TransitiveCardinality = "TRANSITIVE_CARDINALITY",
    UndeclaredClass = "UNDECLARED_CLASS",
    UndeclaredProperty = "UNDECLARED_PROPERTY",
}

export enum ViolationSeverity {
    Error = "ERROR",
    Warning = "WARNING",
}
