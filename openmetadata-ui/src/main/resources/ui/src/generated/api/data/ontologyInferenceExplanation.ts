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
 * Typed explanation of the materialized inference rules that produced an RDF statement.
 */
export interface OntologyInferenceExplanation {
    asserted:     boolean;
    explanations: RuleExplanation[];
    glossary:     EntityReference;
    inferred:     boolean;
    statement:    RDFStatement;
}

export interface RuleExplanation {
    graphUri:            string;
    lastMaterializedAt?: number;
    rule:                InferenceRule;
    tripleCount:         number;
}

/**
 * A SPARQL CONSTRUCT rule that materializes derived triples in the OpenMetadata knowledge
 * graph (e.g. transitive lineage, PII propagation, tag inheritance).
 */
export interface InferenceRule {
    /**
     * What the rule does and why it is enabled. Markdown.
     */
    description?: string;
    /**
     * Human-readable name.
     */
    displayName?: string;
    /**
     * Whether the rule is currently active. Disabled rules are loaded but not applied.
     */
    enabled?: boolean;
    /**
     * Stable identifier for the rule (used as primary key). Lowercase letters, digits, hyphen.
     */
    name: string;
    /**
     * Execution order hint. Lower numbers run first. Rules at the same priority run in name
     * order.
     */
    priority?: number;
    /**
     * The rule body. For ruleType=CONSTRUCT, a SPARQL CONSTRUCT query that emits the inferred
     * triples.
     */
    ruleBody: string;
    /**
     * Body language. CONSTRUCT is a SPARQL CONSTRUCT query that produces new triples. RDFS is a
     * placeholder for future Jena-RDFS rule format.
     */
    ruleType?: RuleType;
    /**
     * Free-form labels (e.g. 'lineage', 'security', 'governance') for filtering in admin UI.
     */
    tags?: string[];
}

/**
 * Body language. CONSTRUCT is a SPARQL CONSTRUCT query that produces new triples. RDFS is a
 * placeholder for future Jena-RDFS rule format.
 */
export enum RuleType {
    Construct = "CONSTRUCT",
    Rdfs = "RDFS",
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
 * A typed, canonical RDF statement used by ontology version diffs.
 */
export interface RDFStatement {
    datatypeIri?:  string;
    language?:     string;
    literalValue?: string;
    objectIri?:    string;
    objectKind:    ObjectKind;
    predicateIri:  string;
    subjectIri:    string;
}

export enum ObjectKind {
    IRI = "IRI",
    Literal = "LITERAL",
}
