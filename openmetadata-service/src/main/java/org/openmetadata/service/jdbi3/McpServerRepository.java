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
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.ai.McpServerResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository
public class McpServerRepository implements EntityPolicy<McpServer> {

  private static final String SERVER_UPDATE_FIELDS =
      "tools,resources,prompts,governanceMetadata,reviewers";

  private static final String SERVER_PATCH_FIELDS =
      "tools,resources,prompts,governanceMetadata,reviewers";

  public McpServerRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                McpServerResource.COLLECTION_PATH,
                Entity.MCP_SERVER,
                McpServer.class,
                Entity.getCollectionDAO().mcpServerDAO()),
            new EntityPolicyContext.WriteFields(
                SERVER_PATCH_FIELDS, SERVER_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
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
    mcpServer.setService(relationships().container(mcpServer.getId(), null));
  }

  @Override
  public void clearFields(McpServer mcpServer, Fields fields) {
    // No additional fields to clear
  }

  @Override
  public void restorePatchAttributes(McpServer original, McpServer updated) {
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public void prepare(McpServer mcpServer, boolean update) {
    if (mcpServer.getService() != null) {
      populateService(mcpServer);
    }
    AIAssetStatusSync.sync(mcpServer);
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public void storeEntity(McpServer mcpServer, boolean update) {
    persistence().store(mcpServer, update);
  }

  @Override
  public void storeRelationships(McpServer mcpServer) {
    if (mcpServer.getService() != null) {
      addServiceRelationship(mcpServer, mcpServer.getService());
    }
  }

  @Override
  public void deleteChildren(UUID id, boolean recursive, boolean hardDelete, String updatedBy) {
    EntityPolicy.super.deleteChildren(id, recursive, hardDelete, updatedBy);
    if (hardDelete) {
      McpExecutionRepository executionRepo =
          (McpExecutionRepository) Entity.getEntityTimeSeriesRepository(Entity.MCP_EXECUTION);
      executionRepo.deleteByServerId(id);
    }
  }

  @Override
  public EntityUpdater<McpServer> getUpdater(
      McpServer original, McpServer updated, EntityOperation operation, ChangeSource changeSource) {
    return new McpServerUpdater(original, updated, operation).mutation();
  }

  @Override
  public EntityReference getParentReference(McpServer entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(McpServer entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    EntityReference service = entity.getService();
    EntityPolicy<?> serviceRepository = Entity.getEntityRepository(service.getType());
    Fields parentFields = serviceRepository.fieldPolicy().supported(fields);
    return service.getId() != null
        ? serviceRepository
            .reads()
            .byId(
                service.getId(),
                new EntityReadService.Query(
                    null, parentFields, RelationIncludes.fromInclude(Include.ALL), true))
        : serviceRepository
            .reads()
            .byName(
                service.getFullyQualifiedName(),
                new EntityReadService.Query(
                    null, parentFields, RelationIncludes.fromInclude(Include.ALL), true));
  }

  private void populateService(McpServer mcpServer) {
    McpService service =
        (McpService) getCachedParentOrLoad(mcpServer.getService(), "", Include.NON_DELETED);
    mcpServer.setService(service.getEntityReference());
  }

  public class McpServerUpdater implements EntitySpecificMutation<McpServer> {

    public McpServerUpdater(McpServer original, McpServer updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<McpServer> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.recordChange(
          "serverType",
          entityUpdate.getOriginal().getServerType(),
          entityUpdate.getUpdated().getServerType());
      entityUpdate.recordChange(
          "transportType",
          entityUpdate.getOriginal().getTransportType(),
          entityUpdate.getUpdated().getTransportType());
      entityUpdate.recordChange(
          "protocolVersion",
          entityUpdate.getOriginal().getProtocolVersion(),
          entityUpdate.getUpdated().getProtocolVersion());
      entityUpdate.recordChange(
          "developmentStage",
          entityUpdate.getOriginal().getDevelopmentStage(),
          entityUpdate.getUpdated().getDevelopmentStage());
      entityUpdate.recordChange(
          "serverInfo",
          entityUpdate.getOriginal().getServerInfo(),
          entityUpdate.getUpdated().getServerInfo(),
          true);
      entityUpdate.recordChange(
          "connectionConfig",
          entityUpdate.getOriginal().getConnectionConfig(),
          entityUpdate.getUpdated().getConnectionConfig(),
          true);
      entityUpdate.recordChange(
          "capabilities",
          entityUpdate.getOriginal().getCapabilities(),
          entityUpdate.getUpdated().getCapabilities(),
          true);
      entityUpdate.recordChange(
          "tools",
          entityUpdate.getOriginal().getTools(),
          entityUpdate.getUpdated().getTools(),
          true);
      entityUpdate.recordChange(
          "resources",
          entityUpdate.getOriginal().getResources(),
          entityUpdate.getUpdated().getResources(),
          true);
      entityUpdate.recordChange(
          "prompts",
          entityUpdate.getOriginal().getPrompts(),
          entityUpdate.getUpdated().getPrompts(),
          true);
      entityUpdate.recordChange(
          "governanceMetadata",
          entityUpdate.getOriginal().getGovernanceMetadata(),
          entityUpdate.getUpdated().getGovernanceMetadata(),
          true);
      entityUpdate.recordChange(
          "dataAccessSummary",
          entityUpdate.getOriginal().getDataAccessSummary(),
          entityUpdate.getUpdated().getDataAccessSummary(),
          true);
      entityUpdate.recordChange(
          "usageMetrics",
          entityUpdate.getOriginal().getUsageMetrics(),
          entityUpdate.getUpdated().getUsageMetrics(),
          true);
      entityUpdate.recordChange(
          "securityMetrics",
          entityUpdate.getOriginal().getSecurityMetrics(),
          entityUpdate.getUpdated().getSecurityMetrics(),
          true);
      entityUpdate.recordChange(
          "usedByApplications",
          entityUpdate.getOriginal().getUsedByApplications(),
          entityUpdate.getUpdated().getUsedByApplications(),
          true);
      entityUpdate.recordChange(
          "sourceCode",
          entityUpdate.getOriginal().getSourceCode(),
          entityUpdate.getUpdated().getSourceCode());
      entityUpdate.recordChange(
          "deploymentUrl",
          entityUpdate.getOriginal().getDeploymentUrl(),
          entityUpdate.getUpdated().getDeploymentUrl());
      entityUpdate.recordChange(
          "documentation",
          entityUpdate.getOriginal().getDocumentation(),
          entityUpdate.getUpdated().getDocumentation());
    }

    private final EntityUpdater<McpServer> entityUpdate;

    public EntityUpdater<McpServer> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<McpServer> entityContext;

  @Override
  public final EntityPolicyContext<McpServer> context() {
    return entityContext;
  }
}
