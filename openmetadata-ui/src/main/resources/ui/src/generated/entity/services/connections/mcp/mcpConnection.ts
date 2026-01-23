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
 * MCP (Model Context Protocol) Service Connection for discovering and cataloging MCP
 * servers, their tools, resources, and prompts.
 */
export interface MCPConnection {
    /**
     * Paths to MCP configuration files to scan for server definitions. Supports Claude Desktop
     * config, VS Code settings, etc.
     */
    configFilePaths?: string[];
    /**
     * Timeout in seconds for connecting to MCP servers
     */
    connectionTimeout?: number;
    /**
     * How to discover MCP servers
     */
    discoveryMethod?: DiscoveryMethod;
    /**
     * Whether to fetch and catalog prompts from MCP servers
     */
    fetchPrompts?: boolean;
    /**
     * Whether to fetch and catalog resources from MCP servers
     */
    fetchResources?: boolean;
    /**
     * Whether to fetch and catalog tools from MCP servers
     */
    fetchTools?: boolean;
    /**
     * Timeout in seconds for MCP server initialization handshake
     */
    initializationTimeout?: number;
    /**
     * URL of MCP registry to query for server discovery (when discoveryMethod is Registry)
     */
    registryUrl?: string;
    /**
     * Regex to only fetch servers with names matching the pattern
     */
    serverFilterPattern?: FilterPattern;
    /**
     * List of MCP servers to connect to directly (when discoveryMethod is DirectConnection)
     */
    servers?:                    MCPServerConfig[];
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: MCPType;
}

/**
 * How to discover MCP servers
 *
 * Method to discover MCP servers
 */
export enum DiscoveryMethod {
    ConfigFile = "ConfigFile",
    DirectConnection = "DirectConnection",
    Registry = "Registry",
}

/**
 * Regex to only fetch servers with names matching the pattern
 *
 * Regex to only fetch entities that matches the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * Configuration for a single MCP server to connect to directly
 */
export interface MCPServerConfig {
    /**
     * API key for authenticated MCP servers
     */
    apiKey?: string;
    /**
     * Arguments to pass to the command
     */
    args?: string[];
    /**
     * Command to execute for Stdio transport (e.g., 'npx', 'uvx', 'python')
     */
    command?: string;
    /**
     * Environment variables for the server process
     */
    env?: { [key: string]: string };
    /**
     * Name to assign to this MCP server
     */
    name:       string;
    transport?: TransportType;
    /**
     * URL for SSE or StreamableHTTP transport
     */
    url?: string;
    [property: string]: any;
}

/**
 * MCP transport protocol type
 */
export enum TransportType {
    SSE = "SSE",
    Stdio = "Stdio",
    StreamableHTTP = "StreamableHTTP",
}

/**
 * Service Type
 *
 * Service type
 */
export enum MCPType {
    MCP = "Mcp",
}
