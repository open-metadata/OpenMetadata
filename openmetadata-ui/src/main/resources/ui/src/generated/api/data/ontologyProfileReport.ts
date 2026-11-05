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
 * OWL 2 DL profile validation result for an authored axiom.
 */
export interface OntologyProfileReport {
    valid:      boolean;
    violations: OntologyProfileViolation[];
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
