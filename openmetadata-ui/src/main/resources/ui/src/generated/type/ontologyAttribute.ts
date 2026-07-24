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
 * A typed attribute governed by an ontology concept.
 */
export interface OntologyAttribute {
    dataType: DataType;
    /**
     * Exact RDF datatype IRI preserved for ontology round trips.
     */
    datatypeIri?: string;
    /**
     * Human-readable meaning of the attribute.
     */
    description?: string;
    /**
     * Allowed values when dataType is ENUM.
     */
    enumValues?: string[];
    /**
     * Stable identifier used by drafts and version diffs.
     */
    id: string;
    /**
     * Canonical IRI of the OWL datatype property.
     */
    iri?: string;
    /**
     * Whether the attribute identifies instances of the concept.
     */
    isIdentifier: boolean;
    /**
     * Name of the attribute within its concept.
     */
    name: string;
    /**
     * Optional unit IRI or display symbol.
     */
    unit?: string;
}

/**
 * Supported value type for an ontology attribute.
 */
export enum DataType {
    Boolean = "BOOLEAN",
    Date = "DATE",
    Decimal = "DECIMAL",
    Enum = "ENUM",
    Integer = "INTEGER",
    String = "STRING",
}
