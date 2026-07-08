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
package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.EntityStatus;

/**
 * Keeps an AI asset's top-level {@code entityStatus} — driven by the AI Asset
 * Approval governance workflow, the same Flowable engine that powers Glossary Term
 * approvals — in sync with the nested governance registration status the AI
 * Governance dashboard reads.
 *
 * <p>Forward: when the workflow (or the intake resource) moves {@code entityStatus}
 * to an approval-flow state, the registration status is updated to match.
 * Reverse: when {@code entityStatus} is unset (existing or freshly seeded assets),
 * it is derived from the registration status so the asset converges to a consistent
 * state on its next save without a separate backfill migration. Shadow AI
 * ({@code Unregistered}) and {@code Registered} assets are left untouched in both
 * directions.
 */
final class AIAssetStatusSync {
  private static final String STATUS_PENDING_APPROVAL = "PendingApproval";
  private static final String STATUS_APPROVED = "Approved";
  private static final String STATUS_REJECTED = "Rejected";
  private static final String LLM_STATUS_PENDING_REVIEW = "PendingReview";

  private AIAssetStatusSync() {}

  static void sync(AIApplication app) {
    EntityStatus status = app.getEntityStatus();
    if (isApprovalStatus(status)) {
      governanceMetadata(app)
          .setRegistrationStatus(
              GovernanceMetadata.RegistrationStatus.fromValue(registrationFor(status)));
    } else if (isUnset(status)) {
      EntityStatus derived = entityStatusFor(registrationOf(app));
      if (derived != null) {
        app.setEntityStatus(derived);
      }
    }
  }

  static void sync(McpServer server) {
    EntityStatus status = server.getEntityStatus();
    if (isApprovalStatus(status)) {
      governanceMetadata(server)
          .setRegistrationStatus(
              McpGovernanceMetadata.RegistrationStatus.fromValue(registrationFor(status)));
    } else if (isUnset(status)) {
      EntityStatus derived = entityStatusFor(registrationOf(server));
      if (derived != null) {
        server.setEntityStatus(derived);
      }
    }
  }

  static void sync(LLMModel model) {
    EntityStatus status = model.getEntityStatus();
    if (isApprovalStatus(status)) {
      model.setGovernanceStatus(LLMModel.GovernanceStatus.fromValue(llmGovernanceFor(status)));
    } else if (isUnset(status)) {
      EntityStatus derived = entityStatusForLlm(governanceStatusOf(model));
      if (derived != null) {
        model.setEntityStatus(derived);
      }
    }
  }

  private static boolean isApprovalStatus(EntityStatus status) {
    return status == EntityStatus.IN_REVIEW
        || status == EntityStatus.APPROVED
        || status == EntityStatus.REJECTED;
  }

  private static boolean isUnset(EntityStatus status) {
    return status == null || status == EntityStatus.UNPROCESSED;
  }

  private static String registrationFor(EntityStatus status) {
    String result;
    switch (status) {
      case APPROVED -> result = STATUS_APPROVED;
      case REJECTED -> result = STATUS_REJECTED;
      default -> result = STATUS_PENDING_APPROVAL;
    }
    return result;
  }

  private static String llmGovernanceFor(EntityStatus status) {
    String result;
    switch (status) {
      case APPROVED -> result = STATUS_APPROVED;
      case REJECTED -> result = STATUS_REJECTED;
      default -> result = LLM_STATUS_PENDING_REVIEW;
    }
    return result;
  }

  private static EntityStatus entityStatusFor(String registrationStatus) {
    EntityStatus result = null;
    if (registrationStatus != null) {
      switch (registrationStatus) {
        case STATUS_PENDING_APPROVAL -> result = EntityStatus.IN_REVIEW;
        case STATUS_APPROVED -> result = EntityStatus.APPROVED;
        case STATUS_REJECTED -> result = EntityStatus.REJECTED;
        default -> result = null;
      }
    }
    return result;
  }

  private static EntityStatus entityStatusForLlm(String governanceStatus) {
    EntityStatus result = null;
    if (governanceStatus != null) {
      switch (governanceStatus) {
        case LLM_STATUS_PENDING_REVIEW -> result = EntityStatus.IN_REVIEW;
        case STATUS_APPROVED -> result = EntityStatus.APPROVED;
        case STATUS_REJECTED -> result = EntityStatus.REJECTED;
        default -> result = null;
      }
    }
    return result;
  }

  private static String registrationOf(AIApplication app) {
    GovernanceMetadata governance = app.getGovernanceMetadata();
    return governance == null || governance.getRegistrationStatus() == null
        ? null
        : governance.getRegistrationStatus().value();
  }

  private static String registrationOf(McpServer server) {
    McpGovernanceMetadata governance = server.getGovernanceMetadata();
    return governance == null || governance.getRegistrationStatus() == null
        ? null
        : governance.getRegistrationStatus().value();
  }

  private static String governanceStatusOf(LLMModel model) {
    return model.getGovernanceStatus() == null ? null : model.getGovernanceStatus().value();
  }

  private static GovernanceMetadata governanceMetadata(AIApplication app) {
    GovernanceMetadata governance = app.getGovernanceMetadata();
    if (governance == null) {
      governance = new GovernanceMetadata();
      app.setGovernanceMetadata(governance);
    }
    return governance;
  }

  private static McpGovernanceMetadata governanceMetadata(McpServer server) {
    McpGovernanceMetadata governance = server.getGovernanceMetadata();
    if (governance == null) {
      governance = new McpGovernanceMetadata();
      server.setGovernanceMetadata(governance);
    }
    return governance;
  }
}
