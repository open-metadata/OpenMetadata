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
 * One definition an import source states, with what applying it would do to the target.
 */
export interface NativeOntologyImportItem {
    /**
     * Concepts the warning names, the clashing concept first.
     */
    conceptIds?: string[];
    /**
     * IRIs of the NEW concepts of this same import that the item states a fact about. A
     * relationship or rule applies only with every one of them.
     */
    dependsOnIris?: string[];
    /**
     * For UPDATE, what changes, for example `Description: none to A customer.`.
     */
    detail?: string;
    /**
     * Derived from what the item states, so it is the same in every preview of one source and a
     * selection survives a second preview.
     */
    id: string;
    /**
     * IRI of the concept or property, or of the subject of a relationship or rule.
     */
    iri?: string;
    kind: Kind;
    /**
     * What a reader calls the item: a display name, or the sentence of a relationship or rule.
     */
    label: string;
    /**
     * The change set operation that applies this item. Absent for ALREADY_EXISTS, DUPLICATE,
     * and SKIPPED.
     */
    operationId?: string;
    /**
     * Why the item is DUPLICATE or SKIPPED.
     */
    reason?: string;
    status:  Status;
    /**
     * A finding applying the item would cause, for example a disjointness clash. The item stays
     * selectable.
     */
    warning?: string;
}

/**
 * What the item is. A rule is any axiom other than a named subclass link or an object
 * property assertion between two named concepts.
 */
export enum Kind {
    Concept = "CONCEPT",
    Property = "PROPERTY",
    Relationship = "RELATIONSHIP",
    Rule = "RULE",
}

/**
 * NEW and UPDATE carry a change set operation. ALREADY_EXISTS matches a stored definition.
 * DUPLICATE repeats an earlier item of the same source. SKIPPED names a reason in `reason`
 * and carries no operation.
 */
export enum Status {
    AlreadyExists = "ALREADY_EXISTS",
    Duplicate = "DUPLICATE",
    New = "NEW",
    Skipped = "SKIPPED",
    Update = "UPDATE",
}
