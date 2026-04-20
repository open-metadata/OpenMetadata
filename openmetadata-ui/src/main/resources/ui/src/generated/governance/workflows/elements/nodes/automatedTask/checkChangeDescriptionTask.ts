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
 * Validates if entity's change description matches specified field patterns.
 */
export interface CheckChangeDescriptionTask {
    branches?: string[];
    config?:   NodeConfiguration;
    /**
     * Description of the Node.
     */
    description?: string;
    /**
     * Display Name that identifies this Node.
     */
    displayName?:       string;
    input?:             string[];
    inputNamespaceMap?: InputNamespaceMap;
    /**
     * Name that identifies this Node.
     */
    name?:    string;
    subType?: string;
    type?:    string;
    [property: string]: any;
}

export interface NodeConfiguration {
    /**
     * Logical operator to combine multiple field checks (AND requires all fields to match, OR
     * requires at least one).
     */
    condition?: LogicalCondition;
    /**
     * Map of fields to their required values/patterns. Checks fieldsAdded, fieldsUpdated, and
     * fieldsDeleted.
     */
    rules: { [key: string]: string[] };
}

/**
 * Logical operator to combine multiple field checks (AND requires all fields to match, OR
 * requires at least one).
 */
export enum LogicalCondition {
    And = "AND",
    Or = "OR",
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
