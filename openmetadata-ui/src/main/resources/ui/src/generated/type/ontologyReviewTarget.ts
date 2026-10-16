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
 * Server-captured immutable ontology release reviewed by an existing approval workflow task.
 */
export interface OntologyReviewTarget {
    author: string;
    /**
     * SHA-256 of ontology-review-v2 canonical content.
     */
    contentDigest: string;
    entityId:      string;
    /**
     * Entity-history version submitted for review; reviewers read this frozen release header.
     */
    entityVersion: number;
    /**
     * Owning ontology ID used to serialize release review decisions.
     */
    ontologyId:     string;
    reviewRevision: number;
    /**
     * SHA-256 of the workflow definition, including its approval policy.
     */
    workflowDefinitionDigest:  string;
    workflowDefinitionVersion: number;
}
