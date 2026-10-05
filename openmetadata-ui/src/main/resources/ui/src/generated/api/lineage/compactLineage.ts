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
 * One page of an entity's lineage, slimmed to identity and relationship info, optionally
 * narrowed to one column, with explicit markers for anything that was not returned.
 */
export interface CompactLineage {
    /**
     * With a column requested: edges out of tables the column reaches that have no column
     * mappings, left out because whether the column flows through them is unknown.
     */
    columnUnmappedEdges?: number;
    /**
     * Downstream edges on this page, nearest hop first.
     */
    downstream?: CompactLineageEdge[];
    /**
     * Downstream edges on this page, set when more edges remain.
     */
    downstreamReturned?: number;
    /**
     * Downstream edges in the whole graph, set when more edges remain.
     */
    downstreamTotal?: number;
    /**
     * True when this page does not complete the graph: more edges remain, or some were skipped
     * as too large.
     */
    edgesTruncated?: boolean;
    /**
     * Edges left out because the asset they lead to did not match the requested entity type or
     * service filters.
     */
    filteredEdges?: number;
    /**
     * Offset of the first edge on this page.
     */
    firstEdge?: number;
    /**
     * True when more edges remain after this page.
     */
    hasMore?: boolean;
    /**
     * Nodes removed because the caller may not view them, or can only reach them through such a
     * node.
     */
    hiddenNodes?: number;
    /**
     * True when the graph exceeded the authorization limit and nodes past it were removed
     * unchecked.
     */
    hiddenNodesUnchecked?: boolean;
    /**
     * Offset of the first edge of the next page, when more edges remain.
     */
    nextFrom?: number;
    /**
     * How many edges were skipped because no response could hold them.
     */
    oversizedEdgeCount?: number;
    /**
     * The first few edges skipped because no response could hold them.
     */
    oversizedEdges?: EdgeEndpoints[];
    /**
     * Edges on this page.
     */
    returnedEdges?: number;
    /**
     * Fully qualified name of the entity the lineage is for.
     */
    root?: string;
    /**
     * Id of the entity the lineage is for.
     */
    rootId?: string;
    /**
     * Entity type of the entity the lineage is for.
     */
    rootType?: string;
    /**
     * Edges in the whole graph, across all pages.
     */
    totalEdges?: number;
    /**
     * How many of the hidden nodes lie past the authorization limit.
     */
    uncheckedNodes?: number;
    /**
     * Upstream edges on this page, nearest hop first.
     */
    upstream?: CompactLineageEdge[];
    /**
     * Upstream edges on this page, set when more edges remain.
     */
    upstreamReturned?: number;
    /**
     * Upstream edges in the whole graph, set when more edges remain.
     */
    upstreamTotal?: number;
}

/**
 * A lineage edge with both endpoints folded in by name, FQN and type.
 */
export interface CompactLineageEdge {
    /**
     * Number of asset-level edges this edge stands for.
     */
    assetEdges?: number;
    /**
     * Column-level mappings on the edge, only when column lineage was requested.
     */
    columnsLineage?: ColumnLineage[];
    /**
     * Description of the edge itself.
     */
    edgeDescription?: string;
    /**
     * Fully qualified name of the source entity.
     */
    fromFQN?: string;
    /**
     * Display name (or name) of the source entity.
     */
    fromName?: string;
    /**
     * Entity type of the source entity.
     */
    fromType?: string;
    /**
     * True when the edge has transformation SQL, whether or not it was returned.
     */
    hasSql?: boolean;
    /**
     * Description of the pipeline carrying the edge, when the caller can view it.
     */
    pipelineDescription?: string;
    /**
     * FQN of the pipeline carrying the edge, when the caller can view it.
     */
    pipelineFQN?: string;
    /**
     * 'sql', or the pipeline that carries the edge as '<type>:<name>'; just '<type>' when the
     * caller cannot view that pipeline.
     */
    relationshipType?: string;
    /**
     * How the edge was recorded (for example query lineage or manual).
     */
    source?: string;
    /**
     * The transformation SQL, only when it was requested.
     */
    sqlQuery?: string;
    /**
     * True when the returned SQL was cut.
     */
    sqlTruncated?: boolean;
    /**
     * Temporary-table hops parsed from the SQL, only when the SQL was requested.
     */
    tempLineageTables?: TempLineageTable[];
    /**
     * Fully qualified name of the target entity.
     */
    toFQN?: string;
    /**
     * Display name (or name) of the target entity.
     */
    toName?: string;
    /**
     * Entity type of the target entity.
     */
    toType?: string;
    /**
     * When the edge was last updated.
     */
    updatedAt?: number;
    /**
     * Who last updated the edge.
     */
    updatedBy?: string;
}

export interface ColumnLineage {
    /**
     * One or more source columns identified by fully qualified column name used by
     * transformation function to create destination column.
     */
    fromColumns?: string[];
    /**
     * Transformation function applied to source columns to create destination column. That is
     * `function(fromColumns) -> toColumn`.
     */
    function?: string;
    /**
     * Destination column identified by fully qualified column name created by the
     * transformation of source columns.
     */
    toColumn?: string;
    [property: string]: any;
}

/**
 * A single hop in a temporary table lineage path.
 */
export interface TempLineageTable {
    /**
     * Source entity or table name for this hop.
     */
    fromEntity: string;
    /**
     * Target entity or table name for this hop.
     */
    toEntity: string;
    [property: string]: any;
}

/**
 * The two endpoints of an edge, identified by FQN.
 */
export interface EdgeEndpoints {
    /**
     * Fully qualified name of the source entity.
     */
    fromFQN?: string;
    /**
     * Fully qualified name of the target entity.
     */
    toFQN?: string;
}
