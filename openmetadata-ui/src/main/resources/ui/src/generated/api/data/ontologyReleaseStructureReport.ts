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
 * Owning release when validating captured content; absent for a working definition.
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
    severity: Severity;
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

export enum Severity {
    Error = "ERROR",
    Warning = "WARNING",
}
