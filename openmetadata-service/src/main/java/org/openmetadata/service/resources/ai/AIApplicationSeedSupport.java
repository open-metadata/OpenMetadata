/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.DevelopmentStage;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.ModelConfiguration;
import org.openmetadata.schema.entity.ai.ModelPurpose;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIApplicationRepository;

final class AIApplicationSeedSupport {
  private static final UUID UNKNOWN_MODEL_ID =
      UUID.fromString("11111111-1111-4111-8111-111111111111");
  private static final String UNKNOWN_MODEL_NAME = "unknown-external";
  private static final String ADMIN_USER = "admin";

  private AIApplicationSeedSupport() {}

  static boolean seedIfMissing(AIApplicationRepository repository, AIApplication app)
      throws Exception {
    if (repository.findByNameOrNull(app.getName(), Include.ALL) != null) {
      return false;
    }
    prepare(app);
    repository.create(null, app);
    return true;
  }

  private static void prepare(AIApplication app) {
    long now = System.currentTimeMillis();
    if (app.getId() == null) {
      app.setId(UUID.randomUUID());
    }
    if (app.getFullyQualifiedName() == null) {
      app.setFullyQualifiedName(app.getName());
    }
    if (app.getUpdatedBy() == null) {
      app.setUpdatedBy(ADMIN_USER);
    }
    if (app.getUpdatedAt() == null) {
      app.setUpdatedAt(now);
    }
    if (app.getModelConfigurations() == null || app.getModelConfigurations().isEmpty()) {
      app.setModelConfigurations(List.of(defaultModelConfiguration()));
    }
    prepareGovernanceMetadata(app, now);
  }

  private static void prepareGovernanceMetadata(AIApplication app, long now) {
    GovernanceMetadata governance = app.getGovernanceMetadata();
    if (governance == null) {
      return;
    }
    if (app.getDevelopmentStage() == null) {
      app.setDevelopmentStage(defaultDevelopmentStage(governance));
    }
    if (governance.getDetection() != null && governance.getDetection().getDetectedAt() == null) {
      governance.getDetection().setDetectedAt(now);
    }
    if (governance.getRegisteredBy() != null && governance.getRegisteredAt() == null) {
      governance.setRegisteredAt(now);
    }
    if (governance.getApprovedBy() != null && governance.getApprovedAt() == null) {
      governance.setApprovedAt(now);
    }
  }

  private static DevelopmentStage defaultDevelopmentStage(GovernanceMetadata governance) {
    if (governance.getRegistrationStatus() == GovernanceMetadata.RegistrationStatus.UNREGISTERED) {
      return DevelopmentStage.Unauthorized;
    }
    if (governance.getRegistrationStatus()
        == GovernanceMetadata.RegistrationStatus.PENDING_APPROVAL) {
      return DevelopmentStage.Staging;
    }
    return DevelopmentStage.Production;
  }

  private static ModelConfiguration defaultModelConfiguration() {
    return new ModelConfiguration()
        .withPurpose(ModelPurpose.Primary)
        .withModel(
            new EntityReference()
                .withId(UNKNOWN_MODEL_ID)
                .withType(Entity.LLM_MODEL)
                .withName(UNKNOWN_MODEL_NAME)
                .withFullyQualifiedName(UNKNOWN_MODEL_NAME)
                .withDisplayName("Unknown external model"));
  }
}
