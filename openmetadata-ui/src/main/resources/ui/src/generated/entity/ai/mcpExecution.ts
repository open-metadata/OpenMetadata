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
 * MCP Execution entity representing a single execution session of an MCP server. Tracks
 * tool calls, resource accesses, prompt uses, and data lineage for audit trails and
 * governance. This is a time-series entity for observability and compliance.
 */
export interface MCPExecution {
    /**
     * AI Application that triggered this execution, if applicable
     */
    applicationContext?: EntityReference;
    /**
     * Compliance checks performed during execution
     */
    complianceChecks?: ComplianceCheckRecord[];
    /**
     * All data sources accessed during execution
     */
    dataAccessed?: DataAccessRecord[];
    /**
     * When true, indicates the entity has been soft deleted
     */
    deleted?: boolean;
    /**
     * Total execution duration in milliseconds
     */
    durationMs?: number;
    /**
     * Execution end timestamp
     */
    endTimestamp?: number;
    /**
     * Environment where execution occurred
     */
    environment?: Environment;
    /**
     * Error message if execution failed
     */
    errorMessage?: string;
    /**
     * Error stack trace if available
     */
    errorStack?: string;
    /**
     * User or system that initiated the execution
     */
    executedBy?: string;
    /**
     * Unique identifier of the MCP Execution
     */
    id?: string;
    /**
     * Additional execution metadata
     */
    metadata?: { [key: string]: string };
    metrics?:  ExecutionMetrics;
    /**
     * Prompt uses during this execution
     */
    promptUses?: PromptUseRecord[];
    /**
     * MCP protocol version used
     */
    protocolVersion?: string;
    /**
     * Resource accesses during this execution
     */
    resourceAccesses?: ResourceAccessRecord[];
    /**
     * MCP Server that was executed
     */
    server: EntityReference;
    /**
     * ID of the MCP Server (for indexing)
     */
    serverId: string;
    /**
     * Version of the MCP server at execution time
     */
    serverVersion?: string;
    /**
     * Session ID for grouping related executions
     */
    sessionId?: string;
    status:     ExecutionStatus;
    /**
     * Execution start timestamp
     */
    timestamp: number;
    /**
     * Tool invocations during this execution
     */
    toolCalls?: ToolCallRecord[];
}

/**
 * AI Application that triggered this execution, if applicable
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the data source accessed
 *
 * Reference to the McpPrompt used
 *
 * Reference to the McpResource accessed
 *
 * MCP Server that was executed
 *
 * Reference to the McpTool that was called
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Record of a compliance check during execution
 */
export interface ComplianceCheckRecord {
    /**
     * Name of the compliance check
     */
    checkName?: string;
    /**
     * Details about the check result
     */
    details?: string;
    /**
     * Whether the check passed
     */
    passed?:    boolean;
    severity?:  ComplianceSeverity;
    timestamp?: number;
}

/**
 * Severity level for compliance checks
 */
export enum ComplianceSeverity {
    Critical = "Critical",
    Error = "Error",
    Info = "Info",
    Warning = "Warning",
}

/**
 * Record of data accessed during execution
 */
export interface DataAccessRecord {
    accessType?: AccessType;
    /**
     * Columns accessed if applicable
     */
    columns?: string[];
    /**
     * Reference to the data source accessed
     */
    dataSource?: EntityReference;
    /**
     * Whether PII data was accessed
     */
    piiAccessed?: boolean;
    /**
     * Number of records accessed
     */
    recordCount?:      number;
    sensitivityLevel?: SensitivityLevel;
    timestamp?:        number;
}

/**
 * Type of data access
 */
export enum AccessType {
    Delete = "Delete",
    Read = "Read",
    Write = "Write",
}

/**
 * Sensitivity level of data accessed
 */
export enum SensitivityLevel {
    Confidential = "Confidential",
    Internal = "Internal",
    Public = "Public",
    Restricted = "Restricted",
}

/**
 * Environment where execution occurred
 */
export enum Environment {
    Development = "Development",
    Production = "Production",
    Staging = "Staging",
    Testing = "Testing",
}

/**
 * Aggregated metrics for the execution
 */
export interface ExecutionMetrics {
    /**
     * Number of compliance violations detected
     */
    complianceViolations?: number;
    /**
     * Number of high-risk operations performed
     */
    highRiskOperations?: number;
    /**
     * Whether confidential or restricted data was accessed
     */
    highSensitivityDataAccessed?: boolean;
    /**
     * Whether any PII data was accessed
     */
    piiDataAccessed?: boolean;
    /**
     * Number of successful tool calls
     */
    successfulToolCalls?: number;
    /**
     * Total number of prompt uses
     */
    totalPromptUses?: number;
    /**
     * Total number of resource accesses
     */
    totalResourceAccesses?: number;
    /**
     * Total number of tool calls
     */
    totalToolCalls?: number;
}

/**
 * Record of a prompt use during execution
 */
export interface PromptUseRecord {
    /**
     * Arguments passed to the prompt
     */
    arguments?: { [key: string]: any };
    /**
     * Reference to the McpPrompt used
     */
    prompt?: EntityReference;
    /**
     * Name of the prompt for quick reference
     */
    promptName?: string;
    timestamp?:  number;
    /**
     * Number of tokens in the generated output
     */
    tokensGenerated?: number;
}

/**
 * Record of a resource access during execution
 */
export interface ResourceAccessRecord {
    accessType?: AccessType;
    /**
     * Bytes read or written
     */
    bytesTransferred?: number;
    /**
     * Reference to the McpResource accessed
     */
    resource?: EntityReference;
    /**
     * URI of the resource accessed
     */
    resourceUri?: string;
    /**
     * Whether the access succeeded
     */
    success?:   boolean;
    timestamp?: number;
}

/**
 * Status of the MCP execution
 */
export enum ExecutionStatus {
    Cancelled = "Cancelled",
    Failed = "Failed",
    Running = "Running",
    Success = "Success",
    Timeout = "Timeout",
}

/**
 * Record of a tool invocation during execution
 */
export interface ToolCallRecord {
    /**
     * Data accessed during this tool call
     */
    dataAccessed?: DataAccessRecord[];
    /**
     * Error message if failed
     */
    errorMessage?: string;
    /**
     * Latency in milliseconds
     */
    latencyMs?: number;
    /**
     * Parameters passed to the tool
     */
    parameters?: { [key: string]: any };
    /**
     * Result returned by the tool
     */
    result?: string;
    /**
     * Whether the tool call succeeded
     */
    success?: boolean;
    /**
     * When the tool was called
     */
    timestamp?: number;
    /**
     * Reference to the McpTool that was called
     */
    tool?: EntityReference;
    /**
     * Name of the tool for quick reference
     */
    toolName?: string;
}
