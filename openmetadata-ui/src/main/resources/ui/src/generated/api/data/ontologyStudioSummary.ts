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
 * Bounded health and scale summary for Ontology Studio.
 */
export interface OntologyStudioSummary {
    /**
     * Percentage of scoped terms with at least one term-to-term relation.
     */
    connectedPercentage: number;
    /**
     * Bounded preview of isolated terms.
     */
    isolatedPreview: GlossaryTermRelationGraphNode[];
    /**
     * Number of scoped terms without a term-to-term relation.
     */
    isolatedTerms: number;
    /**
     * Offset pagination for the isolated-term preview.
     */
    paging: Paging;
    /**
     * Number of active term-to-term relations in scope.
     */
    totalRelations: number;
    /**
     * Number of active glossary terms in scope.
     */
    totalTerms: number;
}

/**
 * A glossary term represented as a node in the relation graph.
 */
export interface GlossaryTermRelationGraphNode {
    /**
     * Optional display name of the glossary term.
     */
    displayName?: string;
    /**
     * Fully qualified name of the glossary term.
     */
    fullyQualifiedName: string;
    /**
     * Identifier of the glossary term.
     */
    id: string;
    /**
     * Name of the glossary term.
     */
    name: string;
}

/**
 * Offset pagination for the isolated-term preview.
 *
 * Type used for cursor based pagination information in GET list responses.
 */
export interface Paging {
    /**
     * After cursor used for getting the next page (see API pagination for details).
     */
    after?: string;
    /**
     * Before cursor used for getting the previous page (see API pagination for details).
     */
    before?: string;
    /**
     * Limit used in case of offset based pagination.
     */
    limit?: number;
    /**
     * Offset used in case of offset based pagination.
     */
    offset?: number;
    /**
     * Total number of entries available to page through.
     */
    total: number;
}
