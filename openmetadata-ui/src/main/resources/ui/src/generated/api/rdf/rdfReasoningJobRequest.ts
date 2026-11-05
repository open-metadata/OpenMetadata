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
 * A reasoning job OpenMetadata submits to the RDF store. It is typed and bounded, and never
 * carries files, remote URLs or code.
 */
export interface RDFReasoningJobRequest {
    check?:   Check;
    explain?: Explain;
    /**
     * OpenMetadata's digest of the selected ontology input, recorded with the result.
     */
    ontologyDigest?: string;
    /**
     * Root ontology of the import closure to check or explain. Required for CHECK and EXPLAIN.
     */
    ontologyIri?:      string;
    ontologySelection: OntologySelection;
    operation:         Operation;
    /**
     * Idempotency key. Submitting the same ID again returns the existing job instead of
     * starting another.
     */
    requestId: string;
    /**
     * OpenMetadata's digest of rules, recorded with the result. Required for REFRESH.
     */
    ruleBundleDigest?: string;
    /**
     * The governance rules a REFRESH applies to a fixed point. Disabled rules take no part.
     */
    rules?: InferenceRule[];
    /**
     * The serving graph OpenMetadata read just before submitting. The store rejects the job
     * when that dataset generation no longer serves.
     */
    sourceRevision: SourceRevision;
}

/**
 * The question a CHECK asks. SATISFIABILITY takes classExpression, SUBSUMPTION takes
 * classExpression and superClassExpression, ENTAILMENT takes statement, and CONSISTENCY
 * takes neither.
 */
export interface Check {
    classExpression?:      OntologyExpression;
    kind:                  CheckKind;
    statement?:            RDFStatement;
    superClassExpression?: OntologyExpression;
}

/**
 * A recursive OWL class expression represented without untyped maps.
 *
 * Class expression qualifying a restriction.
 */
export interface OntologyExpression {
    /**
     * Non-negative cardinality for MIN, MAX, and EXACT restrictions.
     */
    cardinality?: number;
    /**
     * Class IRI when kind is NAMED_CLASS.
     */
    classIri?: string;
    /**
     * Class expression qualifying a restriction.
     */
    filler?: OntologyExpression;
    /**
     * Individual value for an object has-value restriction.
     */
    individualIri?: string;
    /**
     * Named individuals used by an enumeration expression. Presence is enforced per expression
     * kind by the OWL profile guard.
     */
    individualIris?: string[];
    kind:            ExpressionKind;
    /**
     * Literal value for a data has-value restriction.
     */
    literal?: Literal;
    /**
     * Nested expressions for intersection and union expressions. Minimum operand counts are
     * enforced per expression kind by the OWL profile guard.
     */
    operands?: OntologyExpression[];
    /**
     * Property constrained by a restriction.
     */
    propertyIri?:     string;
    restrictionKind?: RestrictionKind;
}

/**
 * Kind of recursive class expression.
 */
export enum ExpressionKind {
    Intersection = "INTERSECTION",
    NamedClass = "NAMED_CLASS",
    OneOf = "ONE_OF",
    Restriction = "RESTRICTION",
    Union = "UNION",
}

/**
 * Literal value for a data has-value restriction.
 *
 * A typed OWL literal.
 */
export interface Literal {
    datatypeIri?: string;
    value:        string;
}

/**
 * Supported OWL restriction operator.
 */
export enum RestrictionKind {
    Exact = "EXACT",
    Max = "MAX",
    Min = "MIN",
    Only = "ONLY",
    Some = "SOME",
    Value = "VALUE",
}

/**
 * CONSISTENCY asks whether the closure has a model. SATISFIABILITY asks whether
 * classExpression can have an instance. SUBSUMPTION asks whether every instance of
 * classExpression is an instance of superClassExpression; a ONE_OF classExpression asks it
 * of named individuals. ENTAILMENT asks whether the closure entails statement.
 */
export enum CheckKind {
    Consistency = "CONSISTENCY",
    Entailment = "ENTAILMENT",
    Satisfiability = "SATISFIABILITY",
    Subsumption = "SUBSUMPTION",
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

/**
 * The statement an EXPLAIN justifies.
 */
export interface Explain {
    /**
     * Most justifications to return. Each one is a minimal set of axioms and governance facts
     * that entails the statement.
     */
    maxJustifications?: number;
    statement:          RDFStatement;
}

/**
 * Which ontology axioms take part. APPROVED is the production set and the only one a
 * refresh accepts. CANDIDATE adds draft axioms, to check a change before it is approved.
 */
export enum OntologySelection {
    Approved = "APPROVED",
    Candidate = "CANDIDATE",
}

/**
 * REFRESH recomputes the deductions from asserted input and publishes them as a new
 * snapshot. CHECK answers one typed question about an import closure. EXPLAIN justifies one
 * statement.
 */
export enum Operation {
    Check = "CHECK",
    Explain = "EXPLAIN",
    Refresh = "REFRESH",
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
 * The serving graph OpenMetadata read just before submitting. The store rejects the job
 * when that dataset generation no longer serves.
 *
 * The serving graph a job reads: its dataset generation, and the highest live write
 * acknowledged before the job was submitted. The store captures after submission, so a job
 * sees at least those writes and possibly later ones; the revision is a conservative label.
 */
export interface SourceRevision {
    /**
     * Identity of the serving dataset, assigned when it was promoted. Promoting a dataset under
     * a reused physical name always assigns a new generation.
     */
    datasetGeneration: string;
    /**
     * Highest acknowledged live-write queue ID.
     */
    liveWriteWatermark: number;
}
