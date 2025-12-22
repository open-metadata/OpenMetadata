/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.di.providers;

import io.dropwizard.core.setup.Environment;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.McpServerProvider;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;

@Slf4j
public class DefaultMCPServerFactory implements MCPServerFactory {

  @Override
  public void registerMCPServer(
      Environment environment,
      Authorizer authorizer,
      Limits limits,
      OpenMetadataApplicationConfig config) {
    try {
      if (ApplicationContext.getInstance().getAppIfExists("McpApplication") != null) {
        LOG.info("Registering MCP server");
        Class<?> mcpServerClass = Class.forName("org.openmetadata.mcp.McpServer");
        McpServerProvider mcpServer =
            (McpServerProvider) mcpServerClass.getDeclaredConstructor().newInstance();
        mcpServer.initializeMcpServer(environment, authorizer, limits, config);
        LOG.info("MCP server registered successfully");
      } else {
        LOG.debug("MCP application not found, skipping MCP server registration");
      }
    } catch (Exception e) {
      LOG.warn("Failed to register MCP server", e);
    }
  }
}
