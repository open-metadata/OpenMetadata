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

import java.nio.charset.StandardCharsets;
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
   * Id stamped on MCP usage rows. No MCP-usage query reads it (the recorder writes and the resource
   * reads by {@code appName}), but the {@code apps_extension_time_series.appId} generated column is
   * {@code NOT NULL}, so a value is required. Derived deterministically from {@link #MCP_APP_NAME}
   * so it is stable across runs without a per-record lookup, now that no {@code McpApplication}
   * entity exists to own a real id.
   */
  public static final UUID MCP_APP_ID =
      UUID.nameUUIDFromBytes(MCP_APP_NAME.getBytes(StandardCharsets.UTF_8));

  private McpAppConstants() {}
}
