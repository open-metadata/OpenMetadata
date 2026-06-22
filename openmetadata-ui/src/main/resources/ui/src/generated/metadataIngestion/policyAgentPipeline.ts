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
 * Policy Agent Pipeline Configuration. Applies access grants against the source system.
 */
export interface PolicyAgentPipeline {
    /**
     * List of access grants to apply on the source.
     */
    policies: Policy[];
    /**
     * Pipeline type
     */
    type: PolicyAgentConfigType;
}

/**
 * A single access grant entry. The per-service shape lives under `config`.
 */
export interface Policy {
    /**
     * Per-service-type policy configuration.
     */
    config: DatabasePolicyConfig;
    /**
     * Unique id of the policy entry.
     */
    id: string;
}

/**
 * Per-service-type policy configuration.
 *
 * Policy config for database service connectors (snowflake, postgres, etc.).
 */
export interface DatabasePolicyConfig {
    accessType: AccessType;
    /**
     * Column on which the grant is applied. Requires tableName. Supported only by connectors
     * that allow column-level grants; ignored otherwise.
     */
    columnName?: string;
    /**
     * List of column names requested when accessType is ColumnLevel.
     */
    columns?: string[];
    /**
     * Database on which the grant is applied.
     */
    databaseName: string;
    /**
     * ISO 8601 duration for which access is granted (e.g. P14D). Connectors that support
     * time-limited grants may use this; others ignore it.
     */
    duration?: string;
    /**
     * Grantee identifier. For USER this is typically the email/username; for ROLE the role name.
     */
    principal:       string;
    principalType?:  PrincipalType;
    requestedAccess: RequestedAccess;
    /**
     * Schema on which the grant is applied. If omitted, the grant is scoped to the database.
     */
    schemaName?: string;
    /**
     * Table on which the grant is applied. Requires schemaName.
     */
    tableName?: string;
}

/**
 * Pattern of access being requested.
 */
export enum AccessType {
    ColumnLevel = "ColumnLevel",
    FullAccess = "FullAccess",
    Masked = "Masked",
}

/**
 * Type of principal the grant is issued to.
 */
export enum PrincipalType {
    Role = "ROLE",
    User = "USER",
}

/**
 * Permission level being requested.
 */
export enum RequestedAccess {
    Admin = "Admin",
    Read = "Read",
    Revoke = "Revoke",
    Write = "Write",
}

/**
 * Pipeline type
 *
 * Policy Agent Pipeline type
 */
export enum PolicyAgentConfigType {
    PolicyAgent = "PolicyAgent",
}
