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
 * Rolls back an entity to its previous approved version. Always rolls back to the most
 * recent 'Approved' status.
 */
export interface RollbackEntityTask {
    config?: NodeConfiguration;
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
    name:                string;
    output?:             string[];
    outputNamespaceMap?: { [key: string]: string };
    subType?:            string;
    type?:               string;
}

export interface NodeConfiguration {
}

export interface InputNamespaceMap {
    relatedEntity: string;
    updatedBy?:    string;
}
