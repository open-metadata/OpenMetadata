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
     * List of configurations to stop propagation based on conditions
     */
    propagationStopConfigs?: PropagationStopConfig[];
    /**
     * Application Type
     */
    type: LineagePropagationActionType;
}

/**
 * Configuration to stop lineage propagation based on conditions
 */
export interface PropagationStopConfig {
    /**
     * The metadata attribute to check for stopping propagation
     */
    metadataAttribute: MetadataAttribute;
    /**
     * List of attribute values that will stop propagation when any of them is matched
     */
    value: string[];
}

/**
 * The metadata attribute to check for stopping propagation
 */
export enum MetadataAttribute {
    Description = "description",
    GlossaryTerms = "glossaryTerms",
    Owner = "owner",
    Tags = "tags",
    Tier = "tier",
}

/**
 * Application Type
 *
 * Lineage propagation action type.
 */
export enum LineagePropagationActionType {
    LineagePropagationAction = "LineagePropagationAction",
}
