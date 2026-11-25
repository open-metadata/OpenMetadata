/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.apps.bundles.mcp;

import java.util.List;

/**
 * Names of the tools the MCP server registered at startup, before read-only mode or disabled tools
 * are applied, so the settings form can offer every tool. It lives here because the MCP module
 * depends on this one, not the other way round. See ADR:2026-11-05-mcp-admins-can-disable-single-tools.
 */
public final class McpToolRegistry {

  private static volatile List<String> toolNames = List.of();

  private McpToolRegistry() {}

  public static void setToolNames(List<String> names) {
    toolNames = List.copyOf(names);
  }

  public static List<String> getToolNames() {
    return toolNames;
  }
}
