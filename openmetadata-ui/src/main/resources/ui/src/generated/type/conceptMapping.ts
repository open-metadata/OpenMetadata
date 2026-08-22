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
 * Mapping from an ontology term to an external concept.
 */
export interface ConceptMapping {
    /**
     * External concept IRI to map this ontology term to.
     */
    conceptIri: string;
    /**
     * Type of mapping used for the external concept alignment.
     */
    mappingType: ConceptMappingType;
    /**
     * Optional external concept scheme IRI for the mapped concept.
     */
    schemeIri?: string;
    /**
     * Optional source label or catalog for the external concept.
     */
    source?: string;
}

/**
 * Type of mapping used for the external concept alignment.
 *
 * Type of mapping used to align this term with an external concept.
 */
export enum ConceptMappingType {
    BroadMatch = "BROAD_MATCH",
    CloseMatch = "CLOSE_MATCH",
    ExactMatch = "EXACT_MATCH",
    NarrowMatch = "NARROW_MATCH",
    RelatedMatch = "RELATED_MATCH",
    SameAs = "SAME_AS",
}
