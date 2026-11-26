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
 * Graph returned when exploring relationships around an entity.
 */
export interface EntityGraph {
    edges:         GraphEdge[];
    filterOptions: GraphFilterOptions;
    nodes:         GraphNode[];
    source:        Source;
    totalEdges:    number;
    totalNodes:    number;
    /**
     * True when traversal or binding links reach a limit and the graph is partial.
     */
    truncated: boolean;
}

export interface GraphEdge {
    arrows: Arrows;
    /**
     * Source node IRI.
     */
    from:  string;
    label: string;
    /**
     * Relationship identifier, including custom predicates.
     */
    relationType: string;
    /**
     * Target node IRI.
     */
    to: string;
}

export enum Arrows {
    To = "to",
}

/**
 * Available entity and relationship types counted before filters are applied.
 */
export interface GraphFilterOptions {
    entityTypes:       GraphFilterOption[];
    relationshipTypes: GraphFilterOption[];
}

export interface GraphFilterOption {
    count: number;
    id:    string;
    label: string;
}

export interface GraphNode {
    description?: string;
    /**
     * Entity identifier extracted from the IRI.
     */
    entityId:            string;
    fullyQualifiedName?: string;
    /**
     * Lowercase entity type.
     */
    group: string;
    /**
     * Entity IRI used as the node identifier.
     */
    id: string;
    /**
     * Display label, omitted when the entity has no display name or name.
     */
    label?: string;
    name?:  string;
    tags?:  GraphTag[];
    type:   string;
}

export interface GraphTag {
    /**
     * Tag label type followed by the tag FQN.
     */
    name:   string;
    tagFQN: string;
}

export enum Source {
    RDF = "rdf",
}
