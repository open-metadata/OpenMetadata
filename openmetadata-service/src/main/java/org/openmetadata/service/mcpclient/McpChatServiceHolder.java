/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.mcpclient;

import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.McpChatSettings;
import org.openmetadata.service.Entity;

/**
 * Holds the single shared {@link McpClientService} built from {@code aiSettings.mcpChat} and the
 * platform {@code llmConfiguration}. Re-initialized at bootstrap and on every AI settings save so
 * the chat feature toggles at runtime without an app install. Holds {@code null} when MCP chat is
 * disabled.
 */
public final class McpChatServiceHolder {
  private static volatile McpClientService instance;
  private static volatile boolean enabled;

  private McpChatServiceHolder() {}

  public static synchronized void initialize(LLMConfiguration llmConfig, McpChatSettings settings) {
    enabled = settings != null && Boolean.TRUE.equals(settings.getEnabled());
    closeQuietly(instance);
    instance =
        enabled
            ? new McpClientService(Entity.getCollectionDAO(), llmConfig, settings.getSystemPrompt())
            : null;
  }

  public static McpClientService get() {
    return instance;
  }

  public static boolean isEnabled() {
    return enabled;
  }

  /** Test seam: inject a deterministic service (and force-enable) for integration tests. */
  public static synchronized void setForTesting(McpClientService service) {
    closeQuietly(instance);
    instance = service;
    enabled = service != null;
  }

  private static void closeQuietly(McpClientService service) {
    if (service != null) {
      service.close();
    }
  }
}
