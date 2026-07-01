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
    /**
     * Outgoing branches this node's delegate can emit. Grant path uses ['granted', 'manual',
     * 'denied']; revoke path (accessType override = Revoke) uses ['revoked', 'manual']. Node
     * authors declare only the branches their delegate actually emits, and each declared branch
     * must have a matching outgoing edge in the workflow.
     */
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
     * When set, forces the accessType sent to the Policy Agent for every asset, overriding the
     * value on the Data Access Request payload. Set to 'Revoke' to tear down previously granted
     * access (the connector emits REVOKE instead of GRANT); on revoke the connector strips
     * whatever the principal holds on the scope (a revoke takes back everything, not a specific
     * level) — requestedAccess on the payload is preserved for audit/UI display but is not used
     * to decide what to tear down. When unset, the agent uses the accessType from the request
     * payload.
     */
    accessType?: AccessType;
    /**
     * Maximum seconds to wait for the Policy Agent pipeline to complete.
     */
    timeoutSeconds: number;
    /**
     * If true, waits for the Policy Agent ingestion pipeline to finish before continuing.
     */
    waitForCompletion: boolean;
}

/**
 * When set, forces the accessType sent to the Policy Agent for every asset, overriding the
 * value on the Data Access Request payload. Set to 'Revoke' to tear down previously granted
 * access (the connector emits REVOKE instead of GRANT); on revoke the connector strips
 * whatever the principal holds on the scope (a revoke takes back everything, not a specific
 * level) — requestedAccess on the payload is preserved for audit/UI display but is not used
 * to decide what to tear down. When unset, the agent uses the accessType from the request
 * payload.
 *
 * Pattern of access being requested.
 */
export enum AccessType {
    ColumnLevel = "ColumnLevel",
    FullAccess = "FullAccess",
    Masked = "Masked",
    Revoke = "Revoke",
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
