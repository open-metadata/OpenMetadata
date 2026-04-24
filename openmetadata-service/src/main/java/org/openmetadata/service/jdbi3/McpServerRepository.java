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

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.McpServerResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

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
  public void setFullyQualifiedName(McpServer mcpServer) {
    if (mcpServer.getService() != null) {
      mcpServer.setFullyQualifiedName(
          FullyQualifiedName.add(
              mcpServer.getService().getFullyQualifiedName(), mcpServer.getName()));
    } else {
      mcpServer.setFullyQualifiedName(mcpServer.getName());
    }
  }

  @Override
  public void setFields(McpServer mcpServer, Fields fields, RelationIncludes relationIncludes) {
    mcpServer.setService(getContainer(mcpServer.getId()));
  }

  @Override
  public void clearFields(McpServer mcpServer, Fields fields) {
    // No additional fields to clear
  }

  @Override
  public void restorePatchAttributes(McpServer original, McpServer updated) {
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public void prepare(McpServer mcpServer, boolean update) {
    if (mcpServer.getService() != null) {
      populateService(mcpServer);
    }
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public void storeEntity(McpServer mcpServer, boolean update) {
    store(mcpServer, update);
  }

  @Override
  public void storeRelationships(McpServer mcpServer) {
    if (mcpServer.getService() != null) {
      addServiceRelationship(mcpServer, mcpServer.getService());
    }
  }

  @Override
  protected void deleteChildren(UUID id, boolean recursive, boolean hardDelete, String updatedBy) {
    super.deleteChildren(id, recursive, hardDelete, updatedBy);
    if (hardDelete) {
      McpExecutionRepository executionRepo =
          (McpExecutionRepository) Entity.getEntityTimeSeriesRepository(Entity.MCP_EXECUTION);
      executionRepo.deleteByServerId(id);
    }
  }

  @Override
  public EntityRepository<McpServer>.EntityUpdater getUpdater(
      McpServer original, McpServer updated, Operation operation, ChangeSource changeSource) {
    return new McpServerUpdater(original, updated, operation);
  }

  @Override
  protected EntityReference getParentReference(McpServer entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(McpServer entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  private void populateService(McpServer mcpServer) {
    McpService service =
        (McpService) getCachedParentOrLoad(mcpServer.getService(), "", Include.NON_DELETED);
    mcpServer.setService(service.getEntityReference());
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
