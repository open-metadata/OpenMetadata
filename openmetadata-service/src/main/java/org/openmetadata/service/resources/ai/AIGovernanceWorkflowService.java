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

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.AIGovernanceActivityResponse;
import org.openmetadata.schema.api.ai.AIGovernanceBulkTriageItem;
import org.openmetadata.schema.api.ai.AIGovernanceBulkTriageRequest;
import org.openmetadata.schema.api.ai.AIGovernanceBulkTriageResponse;
import org.openmetadata.schema.api.ai.AIGovernanceBulkTriageResult;
import org.openmetadata.schema.api.ai.AIGovernanceDashboardResponse;
import org.openmetadata.schema.api.ai.AIGovernancePolicyStatusResponse;
import org.openmetadata.schema.api.ai.AIGovernancePolicyViolationsResponse;
import org.openmetadata.schema.api.ai.IntakeChecksResponse;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernanceRegistration;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Slf4j
final class AIGovernanceWorkflowService {

  private static final Set<String> SUPPORTED_TYPES =
      Set.of(Entity.AI_APPLICATION, Entity.LLM_MODEL, Entity.MCP_SERVER);
  private static final String STATUS_PENDING_APPROVAL = "PendingApproval";
  private static final String STATUS_APPROVED = "Approved";
  private static final String STATUS_REJECTED = "Rejected";

  private final Authorizer authorizer;

  AIGovernanceWorkflowService(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  IntakeChecksResponse getIntakeChecksByFqn(
      SecurityContext securityContext, String entityType, String fqn) {
    authorizeViewByFqn(securityContext, entityType, fqn);
    return IntakeChecks.compute(loadEntityByFqn(entityType, fqn));
  }

  EntityInterface submitForReview(
      SecurityContext securityContext, String entityType, String id, String user) {
    return transitionRegistration(
        securityContext, entityType, id, STATUS_PENDING_APPROVAL, user, null);
  }

  EntityInterface approve(
      SecurityContext securityContext, String entityType, String id, String user, String comment) {
    return transitionRegistration(securityContext, entityType, id, STATUS_APPROVED, user, comment);
  }

  EntityInterface reject(
      SecurityContext securityContext, String entityType, String id, String user, String comment) {
    return transitionRegistration(securityContext, entityType, id, STATUS_REJECTED, user, comment);
  }

  AIGovernanceActivityResponse getActivity(
      SecurityContext securityContext, String entityType, String entityId, int limit) {
    if (entityType != null && entityId != null) {
      authorizeViewById(securityContext, entityType, entityId);
    } else if (entityType != null) {
      authorizeViewResourceType(securityContext, entityType);
    } else {
      authorizeViewAcrossSupportedTypes(securityContext);
    }
    return GovernanceActivity.compute(entityType, entityId, limit);
  }

  AIGovernanceDashboardResponse getDashboard(SecurityContext securityContext) {
    authorizeViewAcrossSupportedTypes(securityContext);
    return DashboardRollup.compute();
  }

  AIGovernancePolicyStatusResponse getPolicyStatus(
      SecurityContext securityContext, String entityType, String id) {
    authorizeViewById(securityContext, entityType, id);
    return new AIGovernancePolicyStatusResponse()
        .withRules(PolicyEvaluator.evaluate(loadEntity(entityType, id), entityType));
  }

  AIGovernancePolicyViolationsResponse getPolicyViolations(
      SecurityContext securityContext, UUID policyId, Long since, int limit) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.AI_GOVERNANCE_POLICY, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(Entity.AI_GOVERNANCE_POLICY, policyId, null));
    authorizeViewAcrossSupportedTypes(securityContext);
    return new AIGovernancePolicyViolationsResponse()
        .withData(PolicyEvaluator.recentViolations(policyId, since, limit));
  }

  AIGovernanceBulkTriageResponse bulkTriage(
      SecurityContext securityContext, AIGovernanceBulkTriageRequest request) {
    List<AIGovernanceBulkTriageResult> results = new ArrayList<>();
    if (request != null && request.getItems() != null) {
      String user = securityContext.getUserPrincipal().getName();
      String targetStatus =
          "Dismiss".equalsIgnoreCase(request.getAction())
              ? STATUS_REJECTED
              : STATUS_PENDING_APPROVAL;
      for (AIGovernanceBulkTriageItem item : request.getItems()) {
        AIGovernanceBulkTriageResult result =
            new AIGovernanceBulkTriageResult()
                .withEntityType(item.getEntityType())
                .withId(item.getId());
        try {
          transitionRegistration(
              securityContext,
              item.getEntityType(),
              item.getId(),
              targetStatus,
              user,
              request.getReason());
          result.setStatus("ok");
        } catch (Exception error) {
          result.setStatus("error");
          result.setMessage(error.getMessage());
          LOG.warn("Bulk triage failed for {}:{}", item.getEntityType(), item.getId(), error);
        }
        results.add(result);
      }
    }
    return new AIGovernanceBulkTriageResponse().withResults(results);
  }

  private EntityInterface loadEntityByFqn(String entityType, String fqn) {
    assertSupported(entityType);
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    return repository.getByName(null, fqn, repository.getFields("owners,tags,domains,extension"));
  }

  private EntityInterface loadEntity(String entityType, String id) {
    assertSupported(entityType);
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    return repository.get(
        null, UUID.fromString(id), repository.getFields("owners,tags,domains,extension"));
  }

  private void assertSupported(String entityType) {
    if (!SUPPORTED_TYPES.contains(entityType)) {
      throw new IllegalArgumentException(
          "Unsupported AI governance entityType '"
              + entityType
              + "'. Supported types: "
              + SUPPORTED_TYPES);
    }
  }

  private EntityInterface transitionRegistration(
      SecurityContext securityContext,
      String entityType,
      String id,
      String newStatus,
      String user,
      String comment) {
    EntityInterface entity = loadEntity(entityType, id);
    String originalJson = JsonUtils.pojoToJson(entity);
    applyStatusTransition(entity, newStatus, user, comment);
    String updatedJson = JsonUtils.pojoToJson(entity);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
    authorizePatch(securityContext, entityType, entity.getId(), patch);

    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    return repository.patch(null, entity.getId(), user, patch).entity();
  }

  private void authorizeViewByFqn(SecurityContext securityContext, String entityType, String fqn) {
    assertSupported(entityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType, null, fqn));
  }

  private void authorizeViewById(SecurityContext securityContext, String entityType, String id) {
    assertSupported(entityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType, UUID.fromString(id), null));
  }

  private void authorizeViewAcrossSupportedTypes(SecurityContext securityContext) {
    for (String entityType : SUPPORTED_TYPES) {
      authorizeViewResourceType(securityContext, entityType);
    }
  }

  private void authorizeViewResourceType(SecurityContext securityContext, String entityType) {
    assertSupported(entityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType));
  }

  private void authorizePatch(
      SecurityContext securityContext, String entityType, UUID id, JsonPatch patch) {
    assertSupported(entityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, patch),
        new ResourceContext<>(entityType, id, null, ResourceContextInterface.Operation.PATCH));
  }

  private void applyStatusTransition(
      EntityInterface entity, String newStatus, String user, String comment) {
    entity.setEntityStatus(mapToEntityStatus(newStatus));
    if (entity instanceof LLMModel llm) {
      llm.setGovernanceStatus(mapToGovernanceStatus(newStatus));
    } else if (entity instanceof AIApplication app) {
      GovernanceMetadata governance =
          app.getGovernanceMetadata() == null
              ? new GovernanceMetadata()
              : app.getGovernanceMetadata();
      governance.setRegistrationStatus(GovernanceMetadata.RegistrationStatus.fromValue(newStatus));
      stampRegistrationMilestones(governance, newStatus, user, comment);
      app.setGovernanceMetadata(governance);
    } else if (entity instanceof McpServer server) {
      McpGovernanceMetadata governance =
          server.getGovernanceMetadata() == null
              ? new McpGovernanceMetadata()
              : server.getGovernanceMetadata();
      governance.setRegistrationStatus(
          McpGovernanceMetadata.RegistrationStatus.fromValue(newStatus));
      stampRegistrationMilestones(governance, newStatus, user, comment);
      server.setGovernanceMetadata(governance);
    }
  }

  private static void stampRegistrationMilestones(
      AIGovernanceRegistration governance, String newStatus, String user, String comment) {
    long now = System.currentTimeMillis();
    if (STATUS_PENDING_APPROVAL.equals(newStatus)) {
      if (governance.getRegisteredBy() == null) {
        governance.setRegisteredBy(user);
      }
      if (governance.getRegisteredAt() == null) {
        governance.setRegisteredAt(now);
      }
    }
    if (STATUS_APPROVED.equals(newStatus)) {
      if (governance.getApprovedBy() == null) {
        governance.setApprovedBy(user);
      }
      if (governance.getApprovedAt() == null) {
        governance.setApprovedAt(now);
      }
    }
    if (comment != null && !comment.isBlank()) {
      governance.setApprovalComments(comment);
    }
  }

  private static EntityStatus mapToEntityStatus(String newStatus) {
    EntityStatus result;
    switch (newStatus) {
      case STATUS_APPROVED:
        result = EntityStatus.APPROVED;
        break;
      case STATUS_PENDING_APPROVAL:
        result = EntityStatus.IN_REVIEW;
        break;
      case STATUS_REJECTED:
        result = EntityStatus.REJECTED;
        break;
      default:
        result = EntityStatus.DRAFT;
    }
    return result;
  }

  private static LLMModel.GovernanceStatus mapToGovernanceStatus(String newStatus) {
    LLMModel.GovernanceStatus result;
    switch (newStatus) {
      case STATUS_APPROVED:
        result = LLMModel.GovernanceStatus.APPROVED;
        break;
      case STATUS_PENDING_APPROVAL:
        result = LLMModel.GovernanceStatus.PENDING_REVIEW;
        break;
      case STATUS_REJECTED:
        result = LLMModel.GovernanceStatus.REJECTED;
        break;
      default:
        result = LLMModel.GovernanceStatus.UNAUTHORIZED;
    }
    return result;
  }
}
