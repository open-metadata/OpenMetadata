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
 * Single MCP tool-call usage record. One row written per tool invocation to the
 * apps_extension_time_series table with extension='limits' (reusing the existing per-app
 * usage extension; rows are isolated by appName='McpApplication'). Used to surface MCP
 * traffic as a product growth metric. Not billed, no enforcement.
 */
export interface MCPToolCallUsage {
    /**
     * Unique identifier of the McpApplication.
     */
    appId?: string;
    /**
     * Name of the application (McpApplication).
     */
    appName?:  string;
    extension: ExtensionType;
    /**
     * True if the tool call returned without an error result.
     */
    success?: boolean;
    /**
     * Time the tool call completed (epoch millis, UTC).
     */
    timestamp?: number;
    /**
     * Name of the MCP tool that was invoked (e.g. search_metadata, create_glossary, nlq_search).
     */
    toolName?: string;
    /**
     * Principal name from the MCP request's security context.
     */
    userName?: string;
}

/**
 * Extension type.
 */
export enum ExtensionType {
    Custom = "custom",
    Limits = "limits",
    Status = "status",
}
