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

import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.ApplicationContext;
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

  public static void record(String toolName, String userName, boolean success) {
    try {
      App app = resolveMcpApp();
      if (app == null) {
        LOG.debug(
            "McpApplication not initialized, skipping MCP usage record for tool {}", toolName);
        return;
      }
      McpToolCallUsage usage =
          new McpToolCallUsage()
              .withAppId(app.getId())
              .withAppName(app.getName())
              .withTimestamp(System.currentTimeMillis())
              .withExtension(AppExtension.ExtensionType.LIMITS)
              .withToolName(toolName)
              .withUserName(userName)
              .withSuccess(success);
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

  private static App resolveMcpApp() {
    AbstractNativeApplication app =
        ApplicationContext.getInstance().getAppIfExists(McpAppConstants.MCP_APP_NAME);
    return app != null ? app.getApp() : null;
  }

  private static CollectionDAO.AppExtensionTimeSeries getDao() {
    return Entity.getCollectionDAO().appExtensionTimeSeriesDao();
  }
}
