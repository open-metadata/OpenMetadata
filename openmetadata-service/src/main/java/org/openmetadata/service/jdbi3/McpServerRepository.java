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

package org.openmetadata.service.jdbi3;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.McpServerResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class McpServerRepository extends EntityRepository<McpServer> {
  private static final String SERVER_UPDATE_FIELDS = "tools,resources,prompts,governanceMetadata";
  private static final String SERVER_PATCH_FIELDS = "tools,resources,prompts,governanceMetadata";

  public McpServerRepository() {
    super(
        McpServerResource.COLLECTION_PATH,
        Entity.MCP_SERVER,
        McpServer.class,
        Entity.getCollectionDAO().mcpServerDAO(),
        SERVER_PATCH_FIELDS,
        SERVER_UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFields(McpServer mcpServer, Fields fields, RelationIncludes relationIncludes) {
    // No additional fields to set beyond base entity fields
  }

  @Override
  public void clearFields(McpServer mcpServer, Fields fields) {
    // No additional fields to clear
  }

  @Override
  public void prepare(McpServer mcpServer, boolean update) {
    // Validate tools, resources, and prompts if needed
  }

  @Override
  public void storeEntity(McpServer mcpServer, boolean update) {
    store(mcpServer, update);
  }

  @Override
  public void storeRelationships(McpServer mcpServer) {
    // Store relationship to AI Applications that use this server
    // Relationships are stored as part of the JSON entity
  }

  @Override
  public EntityRepository<McpServer>.EntityUpdater getUpdater(
      McpServer original, McpServer updated, Operation operation, ChangeSource changeSource) {
    return new McpServerUpdater(original, updated, operation);
  }

  public class McpServerUpdater extends EntityUpdater {
    public McpServerUpdater(McpServer original, McpServer updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("serverType", original.getServerType(), updated.getServerType());
      recordChange("transportType", original.getTransportType(), updated.getTransportType());
      recordChange("protocolVersion", original.getProtocolVersion(), updated.getProtocolVersion());
      recordChange(
          "developmentStage", original.getDevelopmentStage(), updated.getDevelopmentStage());
      recordChange("serverInfo", original.getServerInfo(), updated.getServerInfo(), true);
      recordChange(
          "connectionConfig", original.getConnectionConfig(), updated.getConnectionConfig(), true);
      recordChange("capabilities", original.getCapabilities(), updated.getCapabilities(), true);
      recordChange("tools", original.getTools(), updated.getTools(), true);
      recordChange("resources", original.getResources(), updated.getResources(), true);
      recordChange("prompts", original.getPrompts(), updated.getPrompts(), true);
      recordChange(
          "governanceMetadata",
          original.getGovernanceMetadata(),
          updated.getGovernanceMetadata(),
          true);
      recordChange(
          "dataAccessSummary",
          original.getDataAccessSummary(),
          updated.getDataAccessSummary(),
          true);
      recordChange("usageMetrics", original.getUsageMetrics(), updated.getUsageMetrics(), true);
      recordChange(
          "securityMetrics", original.getSecurityMetrics(), updated.getSecurityMetrics(), true);
      recordChange(
          "usedByApplications",
          original.getUsedByApplications(),
          updated.getUsedByApplications(),
          true);
      recordChange("sourceCode", original.getSourceCode(), updated.getSourceCode());
      recordChange("deploymentUrl", original.getDeploymentUrl(), updated.getDeploymentUrl());
      recordChange("documentation", original.getDocumentation(), updated.getDocumentation());
    }
  }
}
