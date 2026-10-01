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
 * Structured discovery output compiled deterministically into review-only operations.
 */
export interface OntologyDiscoveryProposal {
    classes:        Concept[];
    relationships?: Relationship[];
}

export interface Concept {
    baseVersion?:    number;
    description:     string;
    displayName?:    string;
    evidenceFqns:    string[];
    existingTermId?: string;
    key:             string;
    name:            string;
    parentKey?:      string;
    properties?:     Property[];
    tableBindings?:  Binding[];
}

export interface Property {
    dataType:       DataType;
    description?:   string;
    enumValues?:    string[];
    evidenceFqns:   string[];
    isIdentifier:   boolean;
    name:           string;
    sourceColumns?: OntologySourceColumn[];
    unit?:          string;
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

/**
 * Catalog column realizing an ontology property. Contains identities, never sample values.
 */
export interface OntologySourceColumn {
    columnFqn: string;
    tableFqn:  string;
}

export interface Binding {
    role:     RealizationRole;
    tableFqn: string;
}

/**
 * Role the asset plays in realizing the concept. At most one asset may be the primary store
 * of a concept.
 */
export enum RealizationRole {
    Derived = "DERIVED",
    PrimaryStore = "PRIMARY_STORE",
    Replica = "REPLICA",
}

export interface Relationship {
    evidenceFqns:       string[];
    fromKey:            string;
    relationshipTypeId: string;
    toKey:              string;
}
