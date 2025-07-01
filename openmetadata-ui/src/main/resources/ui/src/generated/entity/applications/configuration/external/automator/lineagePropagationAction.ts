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
 * Propagate description, tags and glossary terms via lineage
 */
export interface LineagePropagationAction {
    /**
     * Direction to propagate metadata in the lineage graph. UPSTREAM propagates to parent entities,
     * DOWNSTREAM propagates to child entities, BOTH propagates in both directions.
     */
    propagationDirection?: PropagationDirection;
    /**
     * Number of levels to propagate upstream in the lineage graph.
     */
    upstreamDepth?: number;
    /**
     * Number of levels to propagate downstream in the lineage graph.
     */
    downstreamDepth?: number;
    /**
     * Update descriptions, tags and Glossary Terms via lineage even if they are already defined
     * in the asset. By default, descriptions are only updated if they are not already defined
     * in the asset, and incoming tags are merged with the existing ones.
     */
    overwriteMetadata?: boolean;
    /**
     * Propagate the metadata to columns via column-level lineage.
     */
    propagateColumnLevel?: boolean;
    /**
     * Propagate description through lineage
     */
    propagateDescription?: boolean;
    /**
     * Propagate glossary terms through lineage
     */
    propagateGlossaryTerms?: boolean;
    /**
     * Propagate owner from the parent
     */
    propagateOwner?: boolean;
    /**
     * Propagate the metadata to the parents (e.g., tables) via lineage.
     */
    propagateParent?: boolean;
    /**
     * Propagate tags through lineage
     */
    propagateTags?: boolean;
    /**
     * Propagate tier from the parent
     */
    propagateTier?: boolean;
    /**
     * Application Type
     */
    type: LineagePropagationActionType;
}

/**
 * Direction of propagation in the lineage graph.
 */
export enum PropagationDirection {
    UPSTREAM = "UPSTREAM",
    DOWNSTREAM = "DOWNSTREAM",
    BOTH = "BOTH"
}

/**
 * Application Type
 *
 * Lineage propagation action type.
 */
export enum LineagePropagationActionType {
    LineagePropagationAction = "LineagePropagationAction",
}
