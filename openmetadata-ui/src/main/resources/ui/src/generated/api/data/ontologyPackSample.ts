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
 * Bounded preview of the concepts and relations that installing the selected modules of a
 * verified library pack creates. The server derives it from the catalogue alone and reads
 * no target ontology.
 */
export interface OntologyPackSample {
    /**
     * Concepts the selection creates, before the preview bound applies.
     */
    conceptCount: number;
    /**
     * At most 60 concepts, starting from the top of the hierarchy.
     */
    concepts: Concept[];
    /**
     * Selected modules with their dependencies, in catalogue order.
     */
    moduleIds: string[];
    packId:    string;
    /**
     * Relations the selection creates, before the preview bound applies.
     */
    relationCount: number;
    /**
     * Relations whose source and target are both in concepts.
     */
    relations: Relation[];
    version:   string;
}

/**
 * Concept that the install creates.
 */
export interface Concept {
    description?: string;
    iri:          string;
    label:        string;
}

/**
 * Relation that the install creates between two concepts.
 */
export interface Relation {
    /**
     * Local name of the property IRI, for example broader.
     */
    label:       string;
    propertyIri: string;
    sourceIri:   string;
    targetIri:   string;
}
