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

/**
 * Single source of truth for the {@link McpApplication} name written into
 * {@code apps_extension_time_series.appName} and queried by the read-side resource. Prevents
 * value drift across the recorder, the MCP server, and the REST resource.
 */
public final class McpAppConstants {

  public static final String MCP_APP_NAME = "McpApplication";

  private McpAppConstants() {}
}
