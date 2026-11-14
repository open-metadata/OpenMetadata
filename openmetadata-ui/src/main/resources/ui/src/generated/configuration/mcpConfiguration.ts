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
     * Exact HTTPS redirect host allowlist, case-insensitive. Empty allows any HTTPS host. No
     * wildcards or suffix matching. Loopback and native redirects are controlled separately.
     * Applies to new registration and new authorization flows.
     */
    allowedRedirectHosts?: string[];
    /**
     * Allow HTTP or HTTPS loopback callbacks for desktop clients.
     */
    allowLoopbackRedirects?: boolean;
    /**
     * Allow private-use URI scheme callbacks for native clients. Disable to require HTTPS or
     * enabled loopback callbacks.
     */
    allowNativeRedirects?: boolean;
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
     * Names of MCP tools to turn off for every user, admins included. A change applies right
     * away to tool calls and to the next tools/list, on each server as it reloads the setting;
     * an MCP client that already listed the tools sees the change when it lists them again. A
     * name that matches no tool is ignored.
     */
    disabledTools?: string[];
    /**
     * Allow anonymous OAuth client registration. Disabling it stops new registrations but
     * preserves existing clients and grants.
     */
    dynamicClientRegistrationEnabled?: boolean;
    /**
     * Enable or disable the MCP server
     */
    enabled?: boolean;
    /**
     * Largest MCP tool response, in characters. Tools return fewer items to stay under it, so
     * it bounds how much of the MCP client's context one call can use. A saved change applies
     * right away on the server that handled the save; other servers in a cluster pick it up on
     * restart.
     */
    maxResponseChars?: number;
    /**
     * Name of the MCP server, reported to clients in initialize. Applies after a restart.
     */
    mcpServerName?: string;
    /**
     * Version of the MCP server, reported to clients in initialize. Applies after a restart.
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
     * Expose only the MCP tools that do not change metadata (annotated readOnlyHint), for every
     * user including admins. A change applies right away to tool calls and to the next
     * tools/list, on each server as it reloads the setting; an MCP client that already listed
     * the tools sees the change when it lists them again.
     */
    readOnly?: boolean;
    /**
     * HTTP read timeout in milliseconds for SSO provider metadata fetching. Default: 30000ms
     * (30 seconds)
     */
    readTimeout?: number;
}
