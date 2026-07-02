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

package org.openmetadata.mcp.usage;

import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.mcp.McpAppConstants;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Best-effort one-row-per-call writer for MCP tool invocations. Records to the
 * {@code apps_extension_time_series} table reusing the {@code limits} extension type — the same
 * per-app usage bucket CollateAI writes to. Rows are isolated from other apps by
 * {@code appName='McpApplication'}, so the shared extension causes no cross-talk. Pure tracking.
 * No billing, no enforcement, no rate-limiting. A recording failure must never break the tool
 * call, so every code path catches and logs.
 */
public final class McpUsageRecorder {

  private static final Logger LOG = LoggerFactory.getLogger(McpUsageRecorder.class);

  private McpUsageRecorder() {}

  /**
   * Records a tool invocation with the full Phase 3 payload. The legacy 3-arg overload below is
   * kept so existing call sites and tests compile unchanged. New call sites should call this one
   * directly with the latency timer reading + error category + client name they already have.
   *
   * @param toolName name of the tool that was invoked
   * @param userName principal name from the security context
   * @param success true when the tool returned without an error result
   * @param latencyMs wall-clock duration in milliseconds, or null when timing wasn't captured
   * @param errorCategory bucket the failure falls into (null on success or when we couldn't
   *     classify the exception)
   * @param clientName best-effort name of the calling client (Claude Desktop / Cursor / VS Code /
   *     CLI), or null when the client didn't identify itself
   */
  public static void record(
      String toolName,
      String userName,
      boolean success,
      Long latencyMs,
      McpToolCallUsage.ErrorCategory errorCategory,
      String clientName) {
    try {
      McpToolCallUsage usage =
          new McpToolCallUsage()
              .withAppId(McpAppConstants.MCP_APP_ID)
              .withAppName(McpAppConstants.MCP_APP_NAME)
              .withTimestamp(System.currentTimeMillis())
              .withExtension(AppExtension.ExtensionType.LIMITS)
              .withToolName(toolName)
              .withUserName(userName)
              .withSuccess(success)
              .withLatencyMs(latencyMs)
              .withErrorCategory(errorCategory)
              .withClientName(clientName);
      getDao().insert(JsonUtils.pojoToJson(usage), AppExtension.ExtensionType.LIMITS.toString());
    } catch (Exception e) {
      LOG.warn(
          "Failed to record MCP usage for tool={} user={} success={}: {}",
          toolName,
          userName,
          success,
          e.getMessage());
    }
  }

  /**
   * Backwards-compatible overload. New call sites should use the 6-arg variant so the row gets
   * the full Phase 3 payload.
   */
  public static void record(String toolName, String userName, boolean success) {
    record(toolName, userName, success, null, null, null);
  }

  private static CollectionDAO.AppExtensionTimeSeries getDao() {
    return Entity.getCollectionDAO().appExtensionTimeSeriesDao();
  }
}
