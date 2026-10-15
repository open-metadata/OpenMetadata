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
 * A glossary's ontology import closure as reasoning reads it: the ontology graphs of its
 * Approved axioms and terms, the relationship-type graphs they use, and the pinned versions
 * of the ontologies it imports. A version manifest in the RDF store pins each member graph
 * with a digest of its triples; the closure digest identifies the whole closure.
 */
export interface RDFOntologyClosure {
    /**
     * Whether this version is the glossary's active Approved version. Always false for a
     * candidate.
     */
    active: boolean;
    /**
     * For a candidate closure, how many requested entities joined it, across the whole import
     * closure.
     */
    candidateCount?: number;
    /**
     * For a candidate closure, the requested entities and what happened to each, up to 1000.
     */
    candidates?: Candidate[];
    /**
     * For a candidate closure, the consistency CHECK OpenMetadata submits to the store for it.
     */
    checkRequest?: RDFReasoningJobRequest;
    /**
     * Digest of the closure: its ontology, selection, member graph digests and imported closure
     * digests. It changes when, and only when, one of those does.
     */
    closureDigest: string;
    /**
     * The glossary's projected axiom and term graphs that take no part, by reason.
     */
    excluded: Exclusion[];
    glossary: EntityReference;
    imports:  ImportedVersion[];
    included: MemberCounts;
    /**
     * The named graph that holds, or would hold, this version's manifest in the RDF store.
     */
    manifestGraph: string;
    /**
     * Graphs the manifest pins directly: the glossary's own members and the relationship-type
     * graphs they use. Imported closures are pinned by their own manifests.
     */
    memberCount: number;
    /**
     * The glossary's ontology IRI: its ontologyConfiguration.baseIri, otherwise its entity IRI.
     */
    ontologyIri: string;
    /**
     * Problems in this closure or any closure it imports.
     */
    problems: Problem[];
    /**
     * Whether the store holds this version's manifest.
     */
    published: boolean;
    selection: OntologySelection;
    /**
     * owl:versionIRI of this closure, derived from the closure digest.
     */
    versionIri: string;
}

export interface Candidate {
    entityId: string;
    /**
     * ontologyAxiom or glossaryTerm.
     */
    entityType?: string;
    /**
     * The entity's ontology graph, when the store holds one.
     */
    graph?:  string;
    outcome: CandidateOutcome;
    /**
     * The lifecycle status the store recorded with the graph.
     */
    status?: string;
}

/**
 * What a candidate check did with a requested entity. INCLUDED: its Draft or In Review
 * graph joins the candidate closure. NOT_PROJECTED: the store holds no graph for it, for
 * example a change set operation that was never applied. ALREADY_APPROVED: it is already a
 * member of the Approved closure. NOT_A_CANDIDATE_STATUS: its status is neither Draft nor
 * In Review. OUTSIDE_CLOSURE: it belongs to a glossary the closure does not import.
 */
export enum CandidateOutcome {
    AlreadyApproved = "ALREADY_APPROVED",
    Included = "INCLUDED",
    NotACandidateStatus = "NOT_A_CANDIDATE_STATUS",
    NotProjected = "NOT_PROJECTED",
    OutsideClosure = "OUTSIDE_CLOSURE",
}

/**
 * For a candidate closure, the consistency CHECK OpenMetadata submits to the store for it.
 *
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

/**
 * How many graphs of one entity type are left out for one reason.
 */
export interface Exclusion {
    count: number;
    /**
     * ontologyAxiom or glossaryTerm.
     */
    entityType: string;
    reason:     ExclusionReason;
}

/**
 * Why a projected axiom or term graph is not part of production reasoning: its owner's
 * lifecycle status is not Approved, or it has no status.
 */
export enum ExclusionReason {
    Archived = "ARCHIVED",
    Deprecated = "DEPRECATED",
    Draft = "DRAFT",
    InReview = "IN_REVIEW",
    NoStatus = "NO_STATUS",
    Rejected = "REJECTED",
    Unprocessed = "UNPROCESSED",
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * The glossary the problem concerns, when there is one.
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
 * The pinned version of a directly imported ontology.
 */
export interface ImportedVersion {
    closureDigest: string;
    glossary:      EntityReference;
    manifestGraph: string;
    ontologyIri:   string;
    selection:     OntologySelection;
    versionIri:    string;
}

/**
 * Ontology graphs that take part, by the kind of entity that owns them.
 */
export interface MemberCounts {
    axioms:            number;
    relationshipTypes: number;
    terms:             number;
}

export interface Problem {
    code: ProblemCode;
    /**
     * The glossary the problem concerns, when there is one.
     */
    glossary?: EntityReference;
    message:   string;
}

/**
 * MISSING_IMPORT: an imported glossary does not exist or is deleted. IMPORT_CYCLE: the
 * imports form a cycle. INCOMPLETE_PROJECTION: the store holds a different number of
 * Approved axiom or term graphs for a glossary than its metadata, so the projection has not
 * caught up or needs a reindex. PROJECTION_NOT_READY: live projection is degraded, so the
 * store may be missing writes. Any problem prevents activation.
 */
export enum ProblemCode {
    ImportCycle = "IMPORT_CYCLE",
    IncompleteProjection = "INCOMPLETE_PROJECTION",
    MissingImport = "MISSING_IMPORT",
    ProjectionNotReady = "PROJECTION_NOT_READY",
}
