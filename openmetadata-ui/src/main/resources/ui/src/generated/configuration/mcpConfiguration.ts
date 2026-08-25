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
 * This schema defines the Model Context Protocol (MCP) Server configuration
 */
export interface MCPConfiguration {
    /**
     * List of allowed origins for CORS on OAuth endpoints. Use specific origins for production
     * security. Wildcard (*) is NOT recommended.
     */
    allowedOrigins?: string[];
    /**
     * Base URL for MCP OAuth endpoints. Used for OAuth metadata (issuer, endpoints). If not
     * set, falls back to system settings. For clustered deployments, set this to the
     * external-facing URL.
     */
    baseUrl?: string;
    /**
     * HTTP connection timeout in milliseconds for SSO provider metadata fetching. Default:
     * 30000ms (30 seconds)
     */
    connectTimeout?: number;
    /**
     * Enable or disable the MCP server
     */
    enabled?: boolean;
    /**
     * Name of the MCP server
     */
    mcpServerName?: string;
    /**
     * Version of the MCP server
     */
    mcpServerVersion?: string;
    /**
     * Expected origin header URI for validation
     */
    originHeaderUri?: string;
    /**
     * Enable or disable origin validation for requests
     */
    originValidationEnabled?: boolean;
    /**
     * Base path for MCP endpoints
     */
    path?: string;
    /**
     * HTTP read timeout in milliseconds for SSO provider metadata fetching. Default: 30000ms
     * (30 seconds)
     */
    readTimeout?: number;
}
