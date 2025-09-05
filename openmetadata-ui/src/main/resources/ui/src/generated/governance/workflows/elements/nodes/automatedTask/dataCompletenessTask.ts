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
 * Evaluates entity data completeness based on field presence and outputs quality bands.
 */
export interface DataCompletenessTask {
    config: CompletenessConfiguration;
    /**
     * Description of what this completeness check does
     */
    description?: string;
    /**
     * User-friendly display name for this node
     */
    displayName?:       string;
    input?:             string[];
    inputNamespaceMap?: InputNamespaceMap;
    /**
     * Unique name that identifies this node in the workflow
     */
    name: string;
    /**
     * Variables this node outputs for use in subsequent nodes
     */
    output?:  string[];
    subType?: string;
    type?:    string;
}

export interface CompletenessConfiguration {
    /**
     * List of entity field paths to evaluate. Supports dot notation for nested fields (e.g.,
     * 'owner.name', 'columns[].description')
     */
    fieldsToCheck: string[];
    /**
     * Define quality levels based on completeness scores. Bands are evaluated from highest to
     * lowest score.
     */
    qualityBands?: QualityBand[];
    /**
     * Consider empty arrays ([]) as missing values
     */
    treatEmptyArrayAsNull?: boolean;
    /**
     * Consider empty strings ('') as missing values
     */
    treatEmptyStringAsNull?: boolean;
}

export interface QualityBand {
    /**
     * Minimum completeness percentage for this band
     */
    minimumScore: number;
    /**
     * Name for this quality band (e.g., 'gold', 'excellent', 'tier1')
     */
    name: string;
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
