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

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.ai.AIApplicationResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class AIApplicationRepository implements EntityPolicy<AIApplication> {

  private static final String FIELD_MCP_SERVERS = "mcpServers";

  private static final String FIELD_PRIMARY_MODEL = "primaryModel";

  private static final String APPLICATION_UPDATE_FIELDS =
      "modelConfigurations,tools,dataSources,reviewers";

  private static final String APPLICATION_PATCH_FIELDS =
      "modelConfigurations,tools,dataSources,reviewers";

  public AIApplicationRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                AIApplicationResource.COLLECTION_PATH,
                Entity.AI_APPLICATION,
                AIApplication.class,
                Entity.getCollectionDAO().aiApplicationDAO()),
            new EntityPolicyContext.WriteFields(
                APPLICATION_PATCH_FIELDS, APPLICATION_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
  }

  @Override
  public void setFields(
      AIApplication aiApplication, Fields fields, RelationIncludes relationIncludes) {
    // No additional fields to set beyond base entity fields
  }

  @Override
  public void clearFields(AIApplication aiApplication, Fields fields) {
    // No additional fields to clear
  }

  @Override
  public void prepare(AIApplication aiApplication, boolean update) {
    // Entity references in modelConfigurations are stored as-is without validation
    // as they may reference external LLM models
    AIAssetStatusSync.sync(aiApplication);
  }

  @Override
  public void storeEntity(AIApplication aiApplication, boolean update) {
    persistence().store(aiApplication, update);
  }

  @Override
  public void storeRelationships(AIApplication aiApplication) {
    // Relationships are stored as part of the JSON entity
    // No additional relationship tables needed for this entity
  }

  @Override
  public EntityUpdater<AIApplication> getUpdater(
      AIApplication original,
      AIApplication updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new AIApplicationUpdater(original, updated, operation).mutation();
  }

  public class AIApplicationUpdater implements EntitySpecificMutation<AIApplication> {

    public AIApplicationUpdater(
        AIApplication original, AIApplication updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<AIApplication> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "applicationType",
          () ->
              entityUpdate.recordChange(
                  "applicationType",
                  entityUpdate.getOriginal().getApplicationType(),
                  entityUpdate.getUpdated().getApplicationType()));
      entityUpdate.compareAndUpdate(
          "developmentStage",
          () ->
              entityUpdate.recordChange(
                  "developmentStage",
                  entityUpdate.getOriginal().getDevelopmentStage(),
                  entityUpdate.getUpdated().getDevelopmentStage()));
      entityUpdate.compareAndUpdate(
          "modelConfigurations",
          () ->
              entityUpdate.recordChange(
                  "modelConfigurations",
                  entityUpdate.getOriginal().getModelConfigurations(),
                  entityUpdate.getUpdated().getModelConfigurations(),
                  true));
      updateModelReferences();
      entityUpdate.compareAndUpdate(
          "promptTemplates",
          () ->
              entityUpdate.recordChange(
                  "promptTemplates",
                  entityUpdate.getOriginal().getPromptTemplates(),
                  entityUpdate.getUpdated().getPromptTemplates(),
                  true));
      entityUpdate.compareAndUpdate(
          "tools",
          () ->
              entityUpdate.recordChange(
                  "tools",
                  entityUpdate.getOriginal().getTools(),
                  entityUpdate.getUpdated().getTools(),
                  true));
      entityUpdate.compareAndUpdate(
          "dataSources",
          () ->
              entityUpdate.recordChange(
                  "dataSources",
                  entityUpdate.getOriginal().getDataSources(),
                  entityUpdate.getUpdated().getDataSources(),
                  true));
      entityUpdate.compareAndUpdate(
          "knowledgeBases",
          () ->
              entityUpdate.recordChange(
                  "knowledgeBases",
                  entityUpdate.getOriginal().getKnowledgeBases(),
                  entityUpdate.getUpdated().getKnowledgeBases(),
                  true));
      entityUpdate.compareAndUpdate(
          "upstreamApplications",
          () ->
              entityUpdate.recordChange(
                  "upstreamApplications",
                  entityUpdate.getOriginal().getUpstreamApplications(),
                  entityUpdate.getUpdated().getUpstreamApplications(),
                  true));
      entityUpdate.compareAndUpdate(
          "downstreamApplications",
          () ->
              entityUpdate.recordChange(
                  "downstreamApplications",
                  entityUpdate.getOriginal().getDownstreamApplications(),
                  entityUpdate.getUpdated().getDownstreamApplications(),
                  true));
      entityUpdate.compareAndUpdate(
          "framework",
          () ->
              entityUpdate.recordChange(
                  "framework",
                  entityUpdate.getOriginal().getFramework(),
                  entityUpdate.getUpdated().getFramework(),
                  true));
      entityUpdate.compareAndUpdate(
          "governanceMetadata",
          () ->
              entityUpdate.recordChange(
                  "governanceMetadata",
                  entityUpdate.getOriginal().getGovernanceMetadata(),
                  entityUpdate.getUpdated().getGovernanceMetadata(),
                  true));
      entityUpdate.compareAndUpdate(
          "biasMetrics",
          () ->
              entityUpdate.recordChange(
                  "biasMetrics",
                  entityUpdate.getOriginal().getBiasMetrics(),
                  entityUpdate.getUpdated().getBiasMetrics(),
                  true));
      entityUpdate.compareAndUpdate(
          "performanceMetrics",
          () ->
              entityUpdate.recordChange(
                  "performanceMetrics",
                  entityUpdate.getOriginal().getPerformanceMetrics(),
                  entityUpdate.getUpdated().getPerformanceMetrics(),
                  true));
      entityUpdate.compareAndUpdate(
          "qualityMetrics",
          () ->
              entityUpdate.recordChange(
                  "qualityMetrics",
                  entityUpdate.getOriginal().getQualityMetrics(),
                  entityUpdate.getUpdated().getQualityMetrics(),
                  true));
      entityUpdate.compareAndUpdate(
          "safetyMetrics",
          () ->
              entityUpdate.recordChange(
                  "safetyMetrics",
                  entityUpdate.getOriginal().getSafetyMetrics(),
                  entityUpdate.getUpdated().getSafetyMetrics(),
                  true));
      entityUpdate.compareAndUpdate(
          "testSuites",
          () ->
              entityUpdate.recordChange(
                  "testSuites",
                  entityUpdate.getOriginal().getTestSuites(),
                  entityUpdate.getUpdated().getTestSuites(),
                  true));
      entityUpdate.compareAndUpdate(
          "sourceCode",
          () ->
              entityUpdate.recordChange(
                  "sourceCode",
                  entityUpdate.getOriginal().getSourceCode(),
                  entityUpdate.getUpdated().getSourceCode()));
      entityUpdate.compareAndUpdate(
          "deploymentUrl",
          () ->
              entityUpdate.recordChange(
                  "deploymentUrl",
                  entityUpdate.getOriginal().getDeploymentUrl(),
                  entityUpdate.getUpdated().getDeploymentUrl()));
      entityUpdate.compareAndUpdate(
          "documentation",
          () ->
              entityUpdate.recordChange(
                  "documentation",
                  entityUpdate.getOriginal().getDocumentation(),
                  entityUpdate.getUpdated().getDocumentation()));
    }

    private void updateModelReferences() {
      entityUpdate.compareAndUpdate(
          FIELD_PRIMARY_MODEL,
          () ->
              entityUpdate.recordChange(
                  FIELD_PRIMARY_MODEL,
                  entityUpdate.getOriginal().getPrimaryModel(),
                  entityUpdate.getUpdated().getPrimaryModel(),
                  true));
      entityUpdate.compareAndUpdate(
          FIELD_MCP_SERVERS,
          () ->
              entityUpdate.recordChange(
                  FIELD_MCP_SERVERS,
                  entityUpdate.getOriginal().getMcpServers(),
                  entityUpdate.getUpdated().getMcpServers(),
                  true));
    }

    private final EntityUpdater<AIApplication> entityUpdate;

    public EntityUpdater<AIApplication> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<AIApplication> entityContext;

  @Override
  public final EntityPolicyContext<AIApplication> context() {
    return entityContext;
  }
}
