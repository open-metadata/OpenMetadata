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
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.AIApplicationResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class AIApplicationRepository extends EntityRepository<AIApplication> {
  private static final String APPLICATION_UPDATE_FIELDS = "modelConfigurations,tools,dataSources";
  private static final String APPLICATION_PATCH_FIELDS = "modelConfigurations,tools,dataSources";

  public AIApplicationRepository() {
    super(
        AIApplicationResource.COLLECTION_PATH,
        Entity.AI_APPLICATION,
        AIApplication.class,
        Entity.getCollectionDAO().aiApplicationDAO(),
        APPLICATION_PATCH_FIELDS,
        APPLICATION_UPDATE_FIELDS);
    supportsSearch = true;
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
  }

  @Override
  public void storeEntity(AIApplication aiApplication, boolean update) {
    store(aiApplication, update);
  }

  @Override
  public void storeRelationships(AIApplication aiApplication) {
    // Relationships are stored as part of the JSON entity
    // No additional relationship tables needed for this entity
  }

  @Override
  public EntityRepository<AIApplication>.EntityUpdater getUpdater(
      AIApplication original,
      AIApplication updated,
      Operation operation,
      ChangeSource changeSource) {
    return new AIApplicationUpdater(original, updated, operation);
  }

  public class AIApplicationUpdater extends EntityUpdater {
    public AIApplicationUpdater(
        AIApplication original, AIApplication updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate(
          "applicationType",
          () -> {
            recordChange(
                "applicationType", original.getApplicationType(), updated.getApplicationType());
          });
      compareAndUpdate(
          "developmentStage",
          () -> {
            recordChange(
                "developmentStage", original.getDevelopmentStage(), updated.getDevelopmentStage());
          });
      compareAndUpdate(
          "modelConfigurations",
          () -> {
            recordChange(
                "modelConfigurations",
                original.getModelConfigurations(),
                updated.getModelConfigurations(),
                true);
          });
      compareAndUpdate(
          "primaryModel",
          () -> {
            recordChange(
                "primaryModel", original.getPrimaryModel(), updated.getPrimaryModel(), true);
          });
      compareAndUpdate(
          "promptTemplates",
          () -> {
            recordChange(
                "promptTemplates",
                original.getPromptTemplates(),
                updated.getPromptTemplates(),
                true);
          });
      compareAndUpdate(
          "tools",
          () -> {
            recordChange("tools", original.getTools(), updated.getTools(), true);
          });
      compareAndUpdate(
          "dataSources",
          () -> {
            recordChange("dataSources", original.getDataSources(), updated.getDataSources(), true);
          });
      compareAndUpdate(
          "knowledgeBases",
          () -> {
            recordChange(
                "knowledgeBases", original.getKnowledgeBases(), updated.getKnowledgeBases(), true);
          });
      compareAndUpdate(
          "upstreamApplications",
          () -> {
            recordChange(
                "upstreamApplications",
                original.getUpstreamApplications(),
                updated.getUpstreamApplications(),
                true);
          });
      compareAndUpdate(
          "downstreamApplications",
          () -> {
            recordChange(
                "downstreamApplications",
                original.getDownstreamApplications(),
                updated.getDownstreamApplications(),
                true);
          });
      compareAndUpdate(
          "framework",
          () -> {
            recordChange("framework", original.getFramework(), updated.getFramework(), true);
          });
      compareAndUpdate(
          "governanceMetadata",
          () -> {
            recordChange(
                "governanceMetadata",
                original.getGovernanceMetadata(),
                updated.getGovernanceMetadata(),
                true);
          });
      compareAndUpdate(
          "biasMetrics",
          () -> {
            recordChange("biasMetrics", original.getBiasMetrics(), updated.getBiasMetrics(), true);
          });
      compareAndUpdate(
          "performanceMetrics",
          () -> {
            recordChange(
                "performanceMetrics",
                original.getPerformanceMetrics(),
                updated.getPerformanceMetrics(),
                true);
          });
      compareAndUpdate(
          "qualityMetrics",
          () -> {
            recordChange(
                "qualityMetrics", original.getQualityMetrics(), updated.getQualityMetrics(), true);
          });
      compareAndUpdate(
          "safetyMetrics",
          () -> {
            recordChange(
                "safetyMetrics", original.getSafetyMetrics(), updated.getSafetyMetrics(), true);
          });
      compareAndUpdate(
          "testSuites",
          () -> {
            recordChange("testSuites", original.getTestSuites(), updated.getTestSuites(), true);
          });
      compareAndUpdate(
          "sourceCode",
          () -> {
            recordChange("sourceCode", original.getSourceCode(), updated.getSourceCode());
          });
      compareAndUpdate(
          "deploymentUrl",
          () -> {
            recordChange("deploymentUrl", original.getDeploymentUrl(), updated.getDeploymentUrl());
          });
      compareAndUpdate(
          "documentation",
          () -> {
            recordChange("documentation", original.getDocumentation(), updated.getDocumentation());
          });
    }
  }
}
