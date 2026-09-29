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
 * A recursive OWL class expression represented without untyped maps.
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
    filler?: FillerClass;
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
    operands?: FillerClass[];
    /**
     * Property constrained by a restriction.
     */
    propertyIri?:     string;
    restrictionKind?: RestrictionKind;
}

/**
 * Class expression qualifying a restriction.
 *
 * A recursive OWL class expression represented without untyped maps.
 */
export interface FillerClass {
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
    filler?: FillerClass;
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
    operands?: FillerClass[];
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
