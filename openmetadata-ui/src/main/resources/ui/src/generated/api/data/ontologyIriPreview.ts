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
 * Expanded IRI and the exact policy inputs used to mint it.
 */
export interface OntologyIRIPreview {
    baseIri:     string;
    candidateId: string;
    glossaryId:  string;
    /**
     * Absolute governed IRI to persist on the new concept.
     */
    iri:     string;
    pattern: string;
    /**
     * IRI-safe expansion of the requested term name.
     */
    termSegment: string;
}
