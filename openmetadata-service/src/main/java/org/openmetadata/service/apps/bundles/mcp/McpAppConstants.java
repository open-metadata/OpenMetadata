/*
 *  Copyright 2025 Collate
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

import java.util.UUID;

/**
 * Single source of truth for the MCP server identity written into
 * {@code apps_extension_time_series.appName}/{@code appId} and queried by the read-side resource,
 * plus the impersonation bot name derived as {@code MCP_APP_NAME + "Bot"}. Prevents value drift
 * across the usage recorder, the MCP server, and the REST resource.
 */
public final class McpAppConstants {

  public static final String MCP_APP_NAME = "McpApplication";

  /**
   * Stable synthetic id stamped on MCP usage rows. Usage is queried by {@code appName}, so this id
   * is informational; a fixed value keeps rows consistent now that no {@code McpApplication} entity
   * exists to own them.
   */
  public static final UUID MCP_APP_ID = UUID.fromString("8f2e4c1a-9b3d-4e6f-a7c8-1d2e3f4a5b6c");

  private McpAppConstants() {}
}
