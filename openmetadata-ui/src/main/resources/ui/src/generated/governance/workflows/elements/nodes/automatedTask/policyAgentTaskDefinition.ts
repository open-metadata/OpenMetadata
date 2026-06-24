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
 * Runs the Policy Agent to enforce data access on supported connectors, or falls back to a
 * manual grant step.
 */
export interface PolicyAgentTaskDefinition {
    branches?: string[];
    config?:   Config;
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

export interface Config {
    /**
     * Maximum seconds to wait for the Policy Agent pipeline to complete.
     */
    timeoutSeconds: number;
    /**
     * If true, waits for the Policy Agent ingestion pipeline to finish before continuing.
     */
    waitForCompletion: boolean;
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
