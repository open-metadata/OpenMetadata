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
package org.openmetadata.service.apps.bundles.mcp;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.internal.McpChatAppConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.clients.llm.LlmConfigHolder;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.mcpclient.McpClientService;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class McpChatApplication extends AbstractNativeApplication {

  @Getter private volatile McpClientService mcpClientService;

  public McpChatApplication(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    initializeService();
  }

  @Override
  public void install(String installedBy) {
    super.install(installedBy);
    initializeService();
  }

  @Override
  public void cleanup() {
    closeService();
    super.cleanup();
  }

  private void initializeService() {
    closeService();

    McpChatAppConfig mcpConfig = resolveAppConfig();
    LLMConfiguration llmConfig = LlmConfigHolder.get();
    this.mcpClientService = new McpClientService(Entity.getCollectionDAO(), llmConfig, mcpConfig);
    LOG.info(
        "McpChatApplication service initialized (chat enabled: {})",
        mcpClientService.isChatEnabled());
  }

  private McpChatAppConfig resolveAppConfig() {
    Object appConfigObj = getApp().getAppConfiguration();
    McpChatAppConfig result;
    if (appConfigObj == null) {
      result = new McpChatAppConfig();
    } else {
      result = JsonUtils.convertValue(appConfigObj, McpChatAppConfig.class);
    }
    return result;
  }

  private void closeService() {
    McpClientService old = this.mcpClientService;
    if (old != null) {
      old.close();
    }
  }
}
