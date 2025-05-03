/*
 *  Copyright 2025 Collate.
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
 * Search Lineage Response for the Lineage Request
 */
export interface SearchLineageResult {
    /**
     * Downstream Edges for the node.
     */
    downstreamEdges?: any;
    /**
     * Nodes in the lineage response.
     */
    nodes?: any;
    /**
     * Upstream Edges for the entity.
     */
    upstreamEdges?: any;
}
