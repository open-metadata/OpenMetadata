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
 * Policy Agent Pipeline Configuration. Applies access grants against the source system for
 * database services.
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
 * A single access grant to apply on the source.
 */
export interface Policy {
    /**
     * Database on which the grant is applied.
     */
    databaseName: string;
    /**
     * Unique id of the policy entry.
     */
    id: string;
    /**
     * Grantee identifier. For USER this is typically the email/username; for ROLE the role name.
     */
    principal:      string;
    principalType?: PrincipalType;
    privilege:      Privilege;
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
 * Type of principal the grant is issued to.
 */
export enum PrincipalType {
    Role = "ROLE",
    User = "USER",
}

/**
 * Privilege to grant.
 */
export enum Privilege {
    All = "ALL",
    Delete = "DELETE",
    Insert = "INSERT",
    Select = "SELECT",
    Update = "UPDATE",
    Usage = "USAGE",
}

/**
 * Pipeline type
 *
 * Policy Agent Pipeline type
 */
export enum PolicyAgentConfigType {
    PolicyAgent = "PolicyAgent",
}
